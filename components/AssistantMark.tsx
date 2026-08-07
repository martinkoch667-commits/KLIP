// Marque de l'assistant — die-cut, comme les stickers de la DA (contour blanc
// via paintOrder, aplats de la charte) plutôt qu'un pictogramme au trait fin.
// Une bulle, les yeux Klip dedans : ça dit « on lui parle » et « il regarde ta
// création » d'un seul coup d'œil, et ça reste lisible à 20px.
//
// Partagée par TOUTES les surfaces IA (pastille de chat, bulles de réponse,
// écran d'attente) : c'est le même visage qui parle et qui travaille.

export default function AssistantMark({ size = 22, blink = true }: { size?: number; blink?: boolean }) {
  const outline = { stroke: '#fff', strokeWidth: 9, strokeLinejoin: 'round' as const, paintOrder: 'stroke' as const };
  return (
    <svg width={size} height={size} viewBox="-6 -6 112 112" overflow="visible" aria-hidden="true">
      {/* Bulle + queue en une seule forme : la découpe reste franche à petite taille. */}
      <path d="M22 8h56a16 16 0 0 1 16 16v38a16 16 0 0 1-16 16H50l-22 16 4-16h-10A16 16 0 0 1 6 62V24A16 16 0 0 1 22 8Z"
        fill="#BDF2A0" {...outline} />
      <g className={blink ? 'stk-eyes-pupils' : undefined} style={{ transformOrigin: '50px 43px' }}>
        <ellipse cx="38" cy="43" rx="8.5" ry="11" fill="#6656D9" />
        <ellipse cx="64" cy="43" rx="8.5" ry="11" fill="#6656D9" />
      </g>
      {/* Éclat : le signal « IA », repris du sticker sparkle (pointes nettes). */}
      <path d="M88 2c3 14 8 19 22 22-14 3-19 8-22 22-3-14-8-19-22-22 14-3 19-8 22-22Z"
        fill="#6656D9" stroke="#fff" strokeWidth="7" strokeLinejoin="miter" strokeMiterlimit={14} paintOrder="stroke" />
    </svg>
  );
}
