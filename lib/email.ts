/* lib/email.ts — envoi d'e-mails via Resend (REST API).
   Inactif tant que RESEND_API_KEY n'est pas défini (mode "prêt à brancher"). */

const RESEND_API = "https://api.resend.com/emails";
const FROM = process.env.EMAIL_FROM ?? "KLIP <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getklip.fr";

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log("[email] RESEND_API_KEY absent — e-mail ignoré:", subject, "→", to);
    return false;
  }
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error("[email] Resend error:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] fetch error:", err);
    return false;
  }
}

/* ── Gabarit commun ──────────────────────────────────────────────────────── */
function shell(title: string, bodyHtml: string, cta?: { label: string; href: string }): string {
  const LOGO = `${APP_URL}/logo-klip-mint.png`;
  return `
  <div style="background:#0C2A1D;padding:40px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:540px;margin:0 auto;">
      <!-- Header -->
      <div style="text-align:center;padding:8px 0 26px;">
        <img src="${LOGO}" alt="Klip" height="30" style="height:30px;width:auto;display:inline-block;" />
      </div>
      <!-- Card -->
      <div style="background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 30px 60px -30px rgba(0,0,0,.5);">
        <div style="height:6px;background:linear-gradient(90deg,#34E0A1,#2FD79B,#C8F135);"></div>
        <div style="padding:36px 34px 30px;">
          <h1 style="margin:0 0 18px;font-size:25px;line-height:1.15;color:#0A0C07;letter-spacing:-.03em;font-weight:800;">${title}</h1>
          <div style="font-size:15.5px;line-height:1.7;color:#4E5247;">${bodyHtml}</div>
          ${cta ? `<div style="margin-top:28px;"><a href="${cta.href}" style="display:inline-block;background:#2FD79B;color:#06281C;font-weight:800;font-size:15px;text-decoration:none;padding:15px 28px;border-radius:999px;">${cta.label} &nbsp;→</a></div>` : ""}
        </div>
        <div style="padding:20px 34px;border-top:1px solid rgba(10,12,7,.07);font-size:12.5px;color:#888B7C;">
          KLIP — l'outil tout-en-un pour gérer l'Instagram de tous vos clients.
        </div>
      </div>
      <!-- Footer -->
      <div style="text-align:center;padding:22px 0 4px;font-size:12px;color:rgba(238,237,227,.5);">
        Vous recevez cet email car vous êtes inscrit·e sur Klip · <a href="${APP_URL}" style="color:#34E0A1;text-decoration:none;">getklip.fr</a>
      </div>
    </div>
  </div>`;
}

/* ── Modèles ─────────────────────────────────────────────────────────────── */
export const emails = {
  welcome: () => ({
    subject: "Bienvenue sur KLIP — votre essai a démarré",
    html: shell(
      "Bienvenue 👋",
      `Votre espace KLIP est prêt et votre <strong>essai gratuit de 7 jours</strong> vient de démarrer. Importez vos visuels, générez vos légendes par IA et planifiez vos publications — pour tous vos clients, au même endroit.`,
      { label: "Ouvrir mon tableau de bord", href: `${APP_URL}/dashboard` }
    ),
  }),
  trialReminder: (daysLeft: number) => ({
    subject: `Il vous reste ${daysLeft} jour${daysLeft > 1 ? "s" : ""} d'essai sur KLIP`,
    html: shell(
      `Plus que ${daysLeft} jour${daysLeft > 1 ? "s" : ""} d'essai`,
      `Votre essai gratuit se termine bientôt. Pour continuer à gérer vos clients sans interruption, choisissez une offre — sans engagement, résiliable à tout moment.`,
      { label: "Choisir mon offre", href: `${APP_URL}/abonnement` }
    ),
  }),
  trialEnded: () => ({
    subject: "Votre essai KLIP est terminé",
    html: shell(
      "Votre essai est arrivé à terme",
      `Votre essai gratuit de 7 jours est terminé. Vos données sont conservées : choisissez une offre pour reprendre là où vous vous êtes arrêté.`,
      { label: "Reprendre avec une offre", href: `${APP_URL}/abonnement` }
    ),
  }),
  waitlistConfirm: () => ({
    subject: "C'est noté — vous êtes sur la liste d'accès anticipé Klip 🎉",
    html: shell(
      "Vous êtes bien inscrit·e !",
      `Merci d'avoir rejoint la <strong>liste d'accès anticipé de Klip</strong>.<br/><br/>
       On vous prévient <strong>par email dès l'ouverture</strong>, avant tout le monde — avec vos avantages réservés aux premiers : <strong>accès prioritaire</strong>, <strong>tarif fondateur</strong> et <strong>onboarding offert</strong>.<br/><br/>
       À très vite 👋`
    ),
  }),
  launch: () => ({
    subject: "🚀 Klip est ouvert — votre accès anticipé est prêt",
    html: shell(
      "Ça y est, Klip ouvre ses portes !",
      `Vous étiez sur la liste d'accès anticipé : <strong>bienvenue parmi les premiers</strong>.<br/><br/>
       Gérez l'Instagram de tous vos clients au même endroit — création de visuels, IA, calendrier, validation client, publication.<br/><br/>
       Vos <strong>avantages d'accès anticipé</strong> (tarif fondateur + onboarding offert) vous attendent. Cliquez ci-dessous pour créer votre compte.`,
      { label: "Activer mon accès anticipé", href: `${APP_URL}/register` }
    ),
  }),
  paymentConfirmed: (planLabel: string) => ({
    subject: "Votre abonnement KLIP est actif ✓",
    html: shell(
      "Merci, votre abonnement est actif",
      `Votre offre <strong>${planLabel}</strong> est désormais active. Bon travail sur KLIP&nbsp;! Vous pouvez gérer votre abonnement à tout moment depuis vos réglages.`,
      { label: "Aller au tableau de bord", href: `${APP_URL}/dashboard` }
    ),
  }),
};
