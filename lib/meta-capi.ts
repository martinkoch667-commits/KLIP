// Meta Conversions API (CAPI) — envoi des conversions côté serveur.
// Complète le Pixel navigateur : le Lead remonte même si le pixel est bloqué
// (adblocker) ou si le navigateur perd l'événement. La déduplication se fait via
// un `event_id` partagé entre le pixel (client) et cet appel serveur.
//
// Sécurité : le token d'accès CAPI est un SECRET → variable d'env META_CAPI_TOKEN
// (Events Manager → Paramètres → API de conversions → Générer un token). Tant
// qu'il n'est pas défini, la CAPI reste silencieusement désactivée (le pixel
// navigateur continue de fonctionner seul).

import crypto from "crypto";

const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "1998010880798347";
const TOKEN = process.env.META_CAPI_TOKEN;
const API_VERSION = "v19.0";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export interface LeadEventInput {
  email: string;
  eventId?: string;          // même id que le pixel navigateur → déduplication Meta
  eventSourceUrl?: string;
  clientIp?: string;
  userAgent?: string;
  fbp?: string;              // cookie _fbp
  fbc?: string;              // cookie _fbc
}

// Envoie un événement standard « Lead » à la Conversions API Meta.
// Ne lève jamais : toute erreur est loggée et avalée (ne doit pas casser l'inscription).
export async function sendLeadEvent(input: LeadEventInput): Promise<void> {
  if (!TOKEN) return; // CAPI non configurée → on ne fait rien (le pixel client suffit)

  const email = input.email.trim().toLowerCase();
  const user_data: Record<string, unknown> = { em: [sha256(email)] };
  if (input.clientIp) user_data.client_ip_address = input.clientIp;
  if (input.userAgent) user_data.client_user_agent = input.userAgent;
  if (input.fbp) user_data.fbp = input.fbp;
  if (input.fbc) user_data.fbc = input.fbc;

  const body = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        ...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
        ...(input.eventId ? { event_id: input.eventId } : {}),
        user_data,
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[meta-capi] Lead non accepté:", res.status, txt.slice(0, 300));
    }
  } catch (e) {
    console.error("[meta-capi] envoi Lead échoué:", e instanceof Error ? e.message : String(e));
  }
}
