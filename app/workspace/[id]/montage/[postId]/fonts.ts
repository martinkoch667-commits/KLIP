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
}
export function declarerPoliceMaison(family: string, url: string) {
  if (typeof document === "undefined" || !family || policesChargees.has(family)) return;
  policesChargees.add(family);
  const st = document.createElement("style");
  st.textContent = `@font-face { font-family: "${family}"; src: url("${url}"); font-display: swap; }`;
  document.head.appendChild(st);
}
