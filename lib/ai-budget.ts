// Plafond journalier global sur la génération d'images — la ceinture par-dessus
// les bretelles du garde-fou par compte (lib/ai-guard).
//
// Il compte TOUTES les images produites dans la journée, tous comptes
// confondus, et coupe au-delà du seuil. C'est la protection de dernier recours :
// si le garde-fou par compte a un trou, ou si vingt comptes se mettent à
// générer en même temps, la facture Gemini reste bornée.
//
// Le compteur vit en base (ai_usage_daily) parce qu'il doit être partagé entre
// toutes les instances serverless, contrairement au garde-fou par compte.
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

/** Images par jour, tous comptes confondus, avant coupure. */
export const DAILY_IMAGE_CAP = Number(process.env.AI_DAILY_IMAGE_CAP ?? 800);

/** À partir de quelle proportion du plafond on prévient par mail. */
const ALERT_AT = 0.8;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type BudgetVerdict = { allowed: boolean; used: number; cap: number };

/**
 * Compte une image et dit si elle est permise.
 *
 * En cas de panne du compteur (base injoignable, migration pas encore passée),
 * on LAISSE PASSER : couper la génération d'images de tous les clients payants
 * parce qu'un compteur ne répond pas serait pire que le risque qu'il couvre.
 * L'incident est journalisé.
 */
export async function chargeImage(): Promise<BudgetVerdict> {
  const db = admin();
  if (!db) return { allowed: true, used: 0, cap: DAILY_IMAGE_CAP };

  const { data, error } = await db.rpc("bump_ai_usage", { p_kind: "image" });
  if (error || typeof data !== "number") {
    console.error("[ai-budget] compteur indisponible, génération laissée passer :", error?.message);
    return { allowed: true, used: 0, cap: DAILY_IMAGE_CAP };
  }

  const used = data;
  if (used === Math.ceil(DAILY_IMAGE_CAP * ALERT_AT) || used === DAILY_IMAGE_CAP) {
    // Une seule fois par seuil : on n'alerte que sur la valeur exacte, donc pas
    // de rafale de mails une fois le plafond franchi.
    void alerte(used);
  }

  return { allowed: used <= DAILY_IMAGE_CAP, used, cap: DAILY_IMAGE_CAP };
}

async function alerte(used: number): Promise<void> {
  const to = process.env.BUG_REPORT_TO?.trim();
  if (!to) {
    console.warn(`[ai-budget] ${used}/${DAILY_IMAGE_CAP} images aujourd'hui — BUG_REPORT_TO absent, pas d'alerte envoyée.`);
    return;
  }
  const atteint = used >= DAILY_IMAGE_CAP;
  const sujet = atteint
    ? `KLIP — plafond d'images atteint (${used}/${DAILY_IMAGE_CAP})`
    : `KLIP — ${used}/${DAILY_IMAGE_CAP} images générées aujourd'hui`;
  const corps = atteint
    ? `<p>La génération d'images est <strong>coupée</strong> jusqu'à demain : ${used} images produites aujourd'hui, tous comptes confondus.</p>
       <p>Si c'est un usage légitime, relève <code>AI_DAILY_IMAGE_CAP</code> dans Vercel et redéploie. Sinon, regarde les logs <code>[ai-guard]</code> pour repérer le compte en cause.</p>`
    : `<p>${used} images générées aujourd'hui, sur un plafond de ${DAILY_IMAGE_CAP}. Au-delà, la génération sera coupée jusqu'à demain.</p>`;
  try {
    await sendEmail(to, sujet, corps);
  } catch (err) {
    console.error("[ai-budget] alerte non envoyée :", err);
  }
}
