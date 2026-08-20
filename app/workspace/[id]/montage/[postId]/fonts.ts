// fonts.ts : déclarer une police au navigateur avant de dessiner avec.
//
/* Déclaration des polices à la volée.

   Une police choisie dans le catalogue n'existe pas tant que le navigateur n'a
   pas sa feuille de style : le texte s'afficherait dans la police par défaut, et
   surtout le découpage en lignes serait mesuré sur la mauvaise fonte. On garde
   trace de ce qui a déjà été déclaré pour ne pas empiler les balises. */
const policesChargees = new Set<string>();
export function chargerPoliceGoogle(family: string) {
  if (typeof document === "undefined" || !family || policesChargees.has(family)) return;
  policesChargees.add(family);
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:ital,wght@0,400;0,700;0,800;1,400;1,700&display=swap`;
  document.head.appendChild(l);
  prevenirQuandPrete();
}
export function declarerPoliceMaison(family: string, url: string) {
  if (typeof document === "undefined" || !family || policesChargees.has(family)) return;
  policesChargees.add(family);
  const st = document.createElement("style");
  st.textContent = `@font-face { font-family: "${family}"; src: url("${url}"); font-display: swap; }`;
  document.head.appendChild(st);
  prevenirQuandPrete();
}

/* ─── Attendre que la police SOIT LÀ avant de mesurer ────────────────────────

   Le découpage d'un titre en lignes se mesure sur un canvas. Tant que la police
   choisie n'est pas chargée, cette mesure porte sur la fonte de repli, plus
   étroite : le texte paraît plus court qu'il ne sera, et il ne revient pas à la
   ligne au bon endroit. Le défaut ne se voit que sur les cas limites, et il est
   fuyant — l'aperçu, mesuré tôt, ne coupait pas, alors que l'export, calculé
   quelques instants plus tard, coupait.

   On prévient donc quand une police finit d'arriver, pour que tout ce qui a
   mesuré trop tôt recommence. */
type Ecouteur = () => void;
const ecouteurs = new Set<Ecouteur>();
function prevenir() { ecouteurs.forEach((f) => { try { f(); } catch { /* un écouteur cassé n'arrête pas les autres */ } }); }

export function surPolicesChargees(cb: Ecouteur): () => void {
  ecouteurs.add(cb);
  if (typeof document !== "undefined" && document.fonts) {
    document.fonts.ready.then(prevenir).catch(() => { /* sans l'API, on garde la mesure de repli */ });
  }
  return () => { ecouteurs.delete(cb); };
}

function prevenirQuandPrete() {
  if (typeof document === "undefined" || !document.fonts) return;
  document.fonts.ready.then(prevenir).catch(() => { /* rien à faire de plus */ });
}
