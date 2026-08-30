// Meta Conversions API (CAPI) — envoi des conversions côté serveur.
// Complète le Pixel navigateur : la conversion remonte même si le pixel est bloqué
// (adblocker) ou si le navigateur perd l'événement. La déduplication se fait via
// un `event_id` partagé entre le pixel (client) et cet appel serveur.
//
// Sécurité : le token d'accès CAPI est un SECRET → variable d'env META_CAPI_TOKEN
// (Events Manager → Paramètres → API de conversions → Générer un token). Tant
// qu'il n'est pas défini, la CAPI reste silencieusement désactivée (le pixel
// navigateur continue de fonctionner seul).
//
// RGPD : cette API envoie les mêmes données personnelles que le pixel, elle est
// donc soumise au MÊME consentement. Les routes qui l'appellent ne le font que
// si le navigateur a signalé un consentement accordé — sans quoi on suivrait
// côté serveur quelqu'un qui vient de refuser le bandeau.

import crypto from "crypto";

// Dataset "KLIP Web" (Meta) — distinct de l'ID d'app Facebook Login (1998010880798347).
const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "1390029399657000";
const TOKEN = process.env.META_CAPI_TOKEN;
const API_VERSION = "v19.0";

/* Code de test de l'outil « Tester les événements » (Gestionnaire d'événements
   → Tester les événements → le code TESTxxxxx affiché en haut). Présent, il
   fait apparaître l'événement en direct dans cet écran.

   À NE JAMAIS LAISSER EN PRODUCTION NORMALE : un événement porteur d'un
   test_event_code est rangé du côté des tests, il n'entre pas dans les
   conversions réelles et n'alimente pas l'optimisation des campagnes. Le
   laisser branché revient à faire tourner ses publicités à l'aveugle. Absente
   ou vide, la variable ne change strictement rien à ce qui est envoyé. */
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE?.trim() || "";

// L'envoi se fait pendant une requête que l'utilisateur attend (retour de
// caisse, départ vers Stripe) : au-delà, on abandonne plutôt que de faire
// patienter quelqu'un devant un écran de chargement pour une statistique.
const TIMEOUT_MS = 2500;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/* Ce que le navigateur peut fournir pour rapprocher l'événement d'un compte
   Meta. Rien n'est obligatoire, mais plus il y en a, meilleur est le taux de
   correspondance — et donc l'optimisation de la campagne. */
export interface CapiIdentity {
  email?: string;
  userId?: string;           // id Supabase → external_id (haché)
  eventId?: string;          // même id que le pixel navigateur → déduplication Meta
  eventSourceUrl?: string;
  clientIp?: string;
  userAgent?: string;
  fbp?: string;              // cookie _fbp
  fbc?: string;              // cookie _fbc
}

interface CapiEvent extends CapiIdentity {
  eventName: string;
  customData?: Record<string, unknown>;
}

/* Envoi d'un événement à la CAPI. Ne lève JAMAIS : toute erreur est loggée et
   avalée. Une conversion publicitaire ne doit pas faire échouer une
   inscription ni un paiement. */
async function sendEvent({ eventName, customData, ...id }: CapiEvent): Promise<void> {
  if (!TOKEN) return; // CAPI non configurée → on ne fait rien (le pixel client suffit)

  const user_data: Record<string, unknown> = {};
  if (id.email) user_data.em = [sha256(id.email.trim().toLowerCase())];
  if (id.userId) user_data.external_id = [sha256(id.userId)];
  if (id.clientIp) user_data.client_ip_address = id.clientIp;
  if (id.userAgent) user_data.client_user_agent = id.userAgent;
  if (id.fbp) user_data.fbp = id.fbp;
  if (id.fbc) user_data.fbc = id.fbc;

  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        ...(id.eventSourceUrl ? { event_source_url: id.eventSourceUrl } : {}),
        ...(id.eventId ? { event_id: id.eventId } : {}),
        ...(customData ? { custom_data: customData } : {}),
        user_data,
      },
    ],
    // À la RACINE du corps, pas dans `data` : Meta l'ignorerait à l'intérieur.
    ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
  };

  /* Trace de l'envoi, pour diagnostiquer sans passer par l'interface Meta.
     Aucune donnée personnelle ici : ni adresse mail, ni identifiant de compte,
     ni cookie. Le code de test est journalisé tel quel, ce n'est pas un secret
     (contrairement au token, qui n'apparaît nulle part). */
  console.info(
    `[meta-capi] envoi ${eventName}`,
    {
      event_id: id.eventId ?? null,
      value: customData?.value ?? null,
      currency: customData?.currency ?? null,
      test_event_code: TEST_EVENT_CODE || "aucun (envoi réel)",
    },
  );

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(`[meta-capi] ${eventName} non accepté:`, res.status, txt.slice(0, 300));
      return;
    }
    /* Ce que Meta dit avoir reçu. `events_received: 1` suffit à trancher entre
       « l'événement n'est jamais parti » et « il est parti mais l'écran de test
       ne le montre pas », qui sont deux pannes très différentes. */
    const ack = (await res.json().catch(() => null)) as
      | { events_received?: number; fbtrace_id?: string }
      | null;
    console.info(
      `[meta-capi] ${eventName} accepté`,
      { events_received: ack?.events_received ?? null, fbtrace_id: ack?.fbtrace_id ?? null },
    );
  } catch (e) {
    console.error(`[meta-capi] envoi ${eventName} échoué:`, e instanceof Error ? e.message : String(e));
  }
}

export interface LeadEventInput extends CapiIdentity {
  email: string;
}

/** Événement standard « Lead » (inscription à la liste d'attente). */
export async function sendLeadEvent(input: LeadEventInput): Promise<void> {
  return sendEvent({ eventName: "Lead", ...input });
}

/* ── Parcours d'essai ───────────────────────────────────────────────────────
   Les mêmes deux événements que le pixel navigateur (voir
   components/analytics/MetaPixel.tsx), avec le même `event_id` : Meta reçoit
   chaque conversion deux fois et n'en garde qu'une. Sans cet id partagé, la
   campagne compterait le double. */

export interface TrialEventInput extends CapiIdentity {
  value: number;
  currency?: string;
  planLabel?: string;      // « Studio », « Agence »… (content_name)
  contentId?: string;      // « solo:yearly » (content_ids)
  period?: "monthly" | "yearly";
}

function trialCustomData(input: TrialEventInput): Record<string, unknown> {
  return {
    value: input.value,
    currency: (input.currency || "EUR").toUpperCase(),
    ...(input.planLabel ? { content_name: input.planLabel } : {}),
    ...(input.period ? { content_category: input.period === "yearly" ? "annuel" : "mensuel" } : {}),
    ...(input.contentId ? { content_ids: [input.contentId], num_items: 1 } : {}),
  };
}

/** Ne garde de l'entrée que ce qui identifie la personne : le reste part dans
    `custom_data`, et Meta refuse les champs qu'il ne connaît pas à la racine. */
function identityOf(input: TrialEventInput): CapiIdentity {
  return {
    email: input.email,
    userId: input.userId,
    eventId: input.eventId,
    eventSourceUrl: input.eventSourceUrl,
    clientIp: input.clientIp,
    userAgent: input.userAgent,
    fbp: input.fbp,
    fbc: input.fbc,
  };
}

/** Départ vers la caisse Stripe. */
export async function sendInitiateCheckoutEvent(input: TrialEventInput): Promise<void> {
  return sendEvent({ eventName: "InitiateCheckout", customData: trialCustomData(input), ...identityOf(input) });
}

/** Abonnement d'essai créé côté Stripe (retour de caisse). */
export async function sendStartTrialEvent(input: TrialEventInput): Promise<void> {
  return sendEvent({ eventName: "StartTrial", customData: trialCustomData(input), ...identityOf(input) });
}
