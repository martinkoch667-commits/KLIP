// Raccourcis clavier : où s'arrête l'éditeur, où commence la frappe.
//
// Un panneau de réglages est plein de champs : curseurs, cases, menus, sélecteurs
// de couleur. Quand on en manipule un, le focus lui reste dessus. Si le garde-fou
// des raccourcis se contente de regarder « le focus est-il dans un <input> ? »,
// alors ⌘Z / Ctrl+Z ne fait plus rien juste après avoir bougé un curseur : le
// navigateur l'envoie à un champ qui n'a rien à annuler, et le montage, lui,
// n'entend jamais le raccourci. C'est exactement le moment où l'on veut annuler.
//
// On ne protège donc que les champs où l'on TAPE vraiment (et le contentEditable
// du canvas) : là, l'annulation native rend le texte qu'on vient d'écrire, et
// annuler tout le projet à la place serait brutal.
const TEXT_INPUT_TYPES = new Set([
  "", "text", "search", "url", "email", "password", "tel", "number", "date",
  "datetime-local", "month", "week", "time",
]);

export function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  return TEXT_INPUT_TYPES.has(((el as HTMLInputElement).type || "").toLowerCase());
}
