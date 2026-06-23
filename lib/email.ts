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
  return `
  <div style="background:#F2F0E6;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid rgba(10,12,7,.08);">
      <div style="background:#062018;padding:24px 32px;">
        <span style="color:#F0EFE4;font-weight:800;font-size:22px;letter-spacing:-.03em;">Kl<span style="color:#34E0A1;">ip</span></span>
      </div>
      <div style="padding:32px;">
        <h1 style="margin:0 0 16px;font-size:22px;color:#0A0C07;letter-spacing:-.02em;">${title}</h1>
        <div style="font-size:15px;line-height:1.65;color:#4E5247;">${bodyHtml}</div>
        ${cta ? `<a href="${cta.href}" style="display:inline-block;margin-top:24px;background:#2FD79B;color:#06281C;font-weight:800;font-size:15px;text-decoration:none;padding:13px 24px;border-radius:999px;">${cta.label}</a>` : ""}
      </div>
      <div style="padding:18px 32px;border-top:1px solid rgba(10,12,7,.08);font-size:12px;color:#888B7C;">
        KLIP — le studio social de tous vos clients.
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
  paymentConfirmed: (planLabel: string) => ({
    subject: "Votre abonnement KLIP est actif ✓",
    html: shell(
      "Merci, votre abonnement est actif",
      `Votre offre <strong>${planLabel}</strong> est désormais active. Bon travail sur KLIP&nbsp;! Vous pouvez gérer votre abonnement à tout moment depuis vos réglages.`,
      { label: "Aller au tableau de bord", href: `${APP_URL}/dashboard` }
    ),
  }),
};
