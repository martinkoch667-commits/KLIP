/* Écriture de user_settings depuis Stripe (webhook et synchronisation).

   Un abonnement qui vient d'être payé DOIT être activé, même si la base est en
   retard d'une migration. C'est déjà arrivé : la prod n'avait pas toutes les
   colonnes et l'app annonçait « enregistré » sans lire ses erreurs.

   Ici le risque est précis. `current_plan` porte une contrainte CHECK qui, avant
   la migration 027, n'accepte que 'solo' et 'agency'. Écrire 'starter' y est
   rejeté (Postgres 23514), et sans filet TOUTE la mise à jour échouerait : un
   client aurait payé sans que son compte s'active.

   On réessaie donc une fois sans `current_plan`, et on le journalise fort : le
   compte s'active, mais il repart sur l'offre Studio et ses six clients. C'est
   un filet, pas un état acceptable — la migration 027 doit être appliquée. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function upsertUserSettings(db: Db, us: Record<string, unknown>) {
  const res = await db.from("user_settings").upsert(us, { onConflict: "user_id" });
  if (!res.error) return res;

  const violeLaContrainte =
    res.error.code === "23514" ||
    /current_plan/i.test(`${res.error.message ?? ""} ${res.error.details ?? ""}`);

  if (violeLaContrainte && "current_plan" in us) {
    console.error(
      `[user_settings] current_plan='${us.current_plan}' refusé par la base ` +
      `(migration 027 non appliquée). Le compte est activé SANS son offre : ` +
      `la limite de clients de Starter ne s'appliquera pas.`,
    );
    const repli = { ...us };
    delete repli.current_plan;
    return await db.from("user_settings").upsert(repli, { onConflict: "user_id" });
  }

  console.error("[user_settings] échec de la mise à jour :", {
    message: res.error.message,
    code: res.error.code,
    details: res.error.details,
  });
  return res;
}
