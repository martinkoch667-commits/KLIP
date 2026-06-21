import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, emails } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Cron quotidien : rappel J-2 + expiration des essais.
   Sécurisé par Authorization: Bearer CRON_SECRET (comme /api/cron/publish). */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const in2days = new Date(now.getTime() + 2 * 24 * 3600 * 1000);

  let reminders = 0;
  let expired = 0;

  // Helper : récupère l'e-mail d'un utilisateur
  const emailOf = async (userId: string): Promise<string | null> => {
    const { data } = await supabase.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  };

  // ── 1. Rappel J-2 : essai en cours, fin dans <= 2 jours, pas encore rappelé ──
  const { data: soon } = await supabase
    .from("user_settings")
    .select("user_id, trial_ends_at")
    .eq("subscription_status", "trialing")
    .eq("trial_reminder_sent", false)
    .gt("trial_ends_at", now.toISOString())
    .lte("trial_ends_at", in2days.toISOString());

  for (const row of soon ?? []) {
    const email = await emailOf(row.user_id);
    if (email) {
      const daysLeft = Math.max(1, Math.ceil((new Date(row.trial_ends_at).getTime() - now.getTime()) / (24 * 3600 * 1000)));
      const tpl = emails.trialReminder(daysLeft);
      await sendEmail(email, tpl.subject, tpl.html);
    }
    await supabase.from("user_settings").update({ trial_reminder_sent: true }).eq("user_id", row.user_id);
    reminders++;
  }

  // ── 2. Expiration : essai en cours dont la date est passée ──────────────────
  const { data: ended } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("subscription_status", "trialing")
    .lt("trial_ends_at", now.toISOString());

  for (const row of ended ?? []) {
    await supabase.from("user_settings").update({ subscription_status: "expired" }).eq("user_id", row.user_id);
    const email = await emailOf(row.user_id);
    if (email) {
      const tpl = emails.trialEnded();
      await sendEmail(email, tpl.subject, tpl.html);
    }
    expired++;
  }

  console.log(`[cron/trials] rappels=${reminders} expirés=${expired}`);
  return NextResponse.json({ reminders, expired });
}
