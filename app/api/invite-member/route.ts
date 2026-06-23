import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPlan } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const { email, agency_id, role } = await req.json();

  if (!email || !agency_id) {
    return NextResponse.json({ error: "Missing email or agency_id" }, { status: 400 });
  }

  // Verify requester is agency owner
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: agency } = await supabase
    .from("agencies")
    .select("id")
    .eq("id", agency_id)
    .eq("owner_id", session.user.id)
    .maybeSingle();

  if (!agency) return NextResponse.json({ error: "Not agency owner" }, { status: 403 });

  // ── Bridage par offre : limite de membres d'équipe ────────────────────────
  const { data: ownerSettings } = await supabase
    .from("user_settings")
    .select("account_type")
    .eq("user_id", session.user.id)
    .maybeSingle();
  const plan = getPlan(ownerSettings?.account_type);
  const { count: memberCount } = await supabase
    .from("agency_members")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agency_id);
  if ((memberCount ?? 0) >= plan.maxMembers) {
    return NextResponse.json({
      error: `Limite atteinte : l'offre ${plan.label} autorise ${plan.maxMembers} membre${plan.maxMembers > 1 ? "s" : ""} (vous compris). Passez à l'offre supérieure pour inviter plus de personnes.`,
      code: "PLAN_LIMIT",
    }, { status: 403 });
  }

  // Requires SUPABASE_SERVICE_ROLE_KEY to invite users
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured. See CHANGELOG.md for setup instructions." },
      { status: 503 }
    );
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://getklip.fr"}/auth/callback`,
    data: { invited_to_agency: agency_id, invited_role: role ?? "member" },
  });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  // Pre-create agency_member row with null accepted_at (pending)
  await supabase.from("agency_members").upsert({
    agency_id,
    user_id: inviteData.user.id,
    role: role ?? "member",
    invited_at: new Date().toISOString(),
    accepted_at: null,
  }, { onConflict: "agency_id,user_id" });

  return NextResponse.json({ ok: true });
}
