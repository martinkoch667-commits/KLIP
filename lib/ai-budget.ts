// Plafonds sur la génération d'images — la ceinture par-dessus les bretelles du
// garde-fou à la minute (lib/ai-guard).
//
// Deux niveaux, deux rôles :
//   · par compte et par jour — ce qui borne un client donné, et donc la marge ;
//   · global et par jour — le dernier recours, si dix clients se déchaînent le
//     même jour ou si le premier niveau a un trou.
//
// Les compteurs vivent en base parce qu'ils doivent être partagés entre toutes
// les instances serverless et survivre à leur redémarrage, contrairement au
// garde-fou à la minute.
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

/** Images par jour et par compte. Au-delà, ce client attend demain. */
export const USER_DAILY_IMAGE_CAP = Number(process.env.AI_USER_DAILY_IMAGE_CAP ?? 50);

/** Images par jour, tous comptes confondus. Filet de sécurité. */
export const DAILY_IMAGE_CAP = Number(process.env.AI_DAILY_IMAGE_CAP ?? 500);

/** À partir de quelle proportion du plafond global on prévient par mail. */
const ALERT_AT = 0.8;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type BudgetVerdict = {
  allowed: boolean;
  /** Qui a bloqué : le quota du compte, ou le plafond global. */
  reason: "ok" | "user" | "global";
  userUsed: number;
  userCap: number;
  globalUsed: number;
  globalCap: number;
};

const PASSE = (): BudgetVerdict => ({
  allowed: true,
  reason: "ok",
  userUsed: 0,
  userCap: USER_DAILY_IMAGE_CAP,
  globalUsed: 0,
  globalCap: DAILY_IMAGE_CAP,
});

/**
 * Compte une image pour ce compte et dit si elle est permise.
 *
 * En cas de panne du compteur (base injoignable, migration pas encore passée),
 * on LAISSE PASSER : couper la génération d'images de tous les clients payants
 * parce qu'un compteur ne répond pas serait pire que le risque qu'il couvre.
 * L'incident est journalisé.
 */
export async function chargeImage(userId: string): Promise<BudgetVerdict> {
  const db = admin();
  if (!db) return PASSE();

  const { data, error } = await db.rpc("bump_ai_quota", { p_user: userId, p_kind: "image" });
  const ligne = Array.isArray(data) ? data[0] : data;
  const globalUsed = Number(ligne?.global_count);
  const userUsed = Number(ligne?.user_count);

  if (error || !Number.isFinite(globalUsed) || !Number.isFinite(userUsed)) {
    console.error("[ai-budget] compteur indisponible, génération laissée passer :", error?.message);
    return PASSE();
  }

  if (globalUsed === Math.ceil(DAILY_IMAGE_CAP * ALERT_AT) || globalUsed === DAILY_IMAGE_CAP) {
    // Sur la valeur exacte seulement : pas de rafale de mails une fois franchi.
    void alerte(globalUsed);
  }

  // Le quota du compte prime dans le message : c'est celui que le client peut
  // comprendre et anticiper, là où le plafond global ne le regarde pas.
  const reason: BudgetVerdict["reason"] =
    userUsed > USER_DAILY_IMAGE_CAP ? "user" : globalUsed > DAILY_IMAGE_CAP ? "global" : "ok";

  return {
    allowed: reason === "ok",
    reason,
    userUsed,
    userCap: USER_DAILY_IMAGE_CAP,
    globalUsed,
    globalCap: DAILY_IMAGE_CAP,
  };
}

async function alerte(used: number): Promise<void> {
  const to = process.env.BUG_REPORT_TO?.trim();
  if (!to) {
    console.warn(`[ai-budget] ${used}/${DAILY_IMAGE_CAP} images aujourd'hui — BUG_REPORT_TO absent, pas d'alerte envoyée.`);
    return;
  }
  const atteint = used >= DAILY_IMAGE_CAP;
  const sujet = atteint
    ? `KLIP — plafond global d'images atteint (${used}/${DAILY_IMAGE_CAP})`
    : `KLIP — ${used}/${DAILY_IMAGE_CAP} images générées aujourd'hui`;
  const corps = atteint
    ? `<p>La génération d'images est <strong>coupée</strong> jusqu'à demain : ${used} images produites aujourd'hui, tous comptes confondus.</p>
       <p>Si c'est un usage légitime, relève <code>AI_DAILY_IMAGE_CAP</code> dans Vercel et redéploie. Sinon, regarde les logs <code>[ai-guard]</code> pour repérer le compte en cause.</p>`
    : `<p>${used} images générées aujourd'hui, sur un plafond global de ${DAILY_IMAGE_CAP}. Au-delà, la génération sera coupée jusqu'à demain.</p>`;
  try {
    await sendEmail(to, sujet, corps);
  } catch (err) {
    console.error("[ai-budget] alerte non envoyée :", err);
  }
}
