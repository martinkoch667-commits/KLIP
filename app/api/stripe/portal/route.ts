import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { stripe, APP_URL } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!stripe) {
    return NextResponse.json({ error: "Le paiement n'est pas encore activé.", code: "STRIPE_OFF" }, { status: 503 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: settings } = await supabase
    .from("user_settings")
    .select("stripe_customer_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  const customerId = settings?.stripe_customer_id as string | undefined;
  if (!customerId) {
    return NextResponse.json({ error: "Aucun abonnement à gérer." }, { status: 400 });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/settings`,
  });
  return NextResponse.json({ url: portal.url });
}
