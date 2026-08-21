/**
 * Les volumes du tableau de bord.
 *
 * Des illustrations, pas des pictos : chaque compteur porte un petit objet en
 * relief qui dit de quoi il parle. Tout est vectoriel — dégradés, reflets et
 * ombres portées dessinés à la main — plutôt qu'une image : ça reste net sur
 * tous les écrans, ça pèse quelques kilos-octets, et les couleurs sortent de la
 * charte au lieu d'être celles d'une banque d'images.
 *
 * Recette du relief, la même partout : un dégradé du clair (en haut à gauche,
 * d'où vient la lumière) vers le foncé, un reflet blanc très transparent sur la
 * face éclairée, une ombre portée molle au sol.
 */

interface PropsVolume {
  taille?: number;
  className?: string;
}

/* Ombre au sol, commune à tous les objets. */
function Sol({ cx = 60, cy = 104, rx = 40, ry = 8 }: { cx?: number; cy?: number; rx?: number; ry?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="rgba(16,22,14,.16)" filter="url(#flou-sol)" />;
}

function Cadre({ taille = 120, children, className }: PropsVolume & { children: React.ReactNode }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true" focusable="false">
      <defs>
        <filter id="flou-sol" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      {children}
    </svg>
  );
}

/* ── À publier aujourd'hui : deux posts empilés, un éclair posé dessus ────── */

export function VolEclair(p: PropsVolume) {
  return (
    <Cadre {...p}>
      <defs>
        <linearGradient id="v-ecl-face" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#EDFFDC" /><stop offset="0.4" stopColor="#BDF2A0" /><stop offset="1" stopColor="#88CE63" />
        </linearGradient>
        <linearGradient id="v-ecl-tranche" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5E9E3C" /><stop offset="1" stopColor="#37692A" />
        </linearGradient>
      </defs>
      <Sol cx={58} cy={106} rx={26} ry={6} />
      {/* la tranche, décalée en bas à droite : c'est elle qui donne l'épaisseur */}
      <g transform="translate(30 12)">
        <path d="M36 0 4 44h20l-6 40 34-48H30Z" fill="url(#v-ecl-tranche)" transform="translate(6 6)" />
        <path d="M36 0 4 44h20l-6 40 34-48H30Z" fill="url(#v-ecl-face)" />
        {/* reflet sur la face éclairée, et une arête claire sur le pli */}
        <path d="M36 0 4 44h11L32 9Z" fill="#FFFFFF" fillOpacity=".5" />
        <path d="M30 36h22L18 84l4-30Z" fill="#FFFFFF" fillOpacity=".14" />
      </g>
    </Cadre>
  );
}

/* ── En attente de validation : un sablier, le temps qui coule ────────────── */

export function VolSablier(p: PropsVolume) {
  return (
    <Cadre {...p}>
      <defs>
        <linearGradient id="v-verre" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity=".95" /><stop offset="1" stopColor="#F2D9BF" stopOpacity=".85" />
        </linearGradient>
        <linearGradient id="v-bois" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F0A45E" /><stop offset="1" stopColor="#B96A22" />
        </linearGradient>
        <linearGradient id="v-sable" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFCE8E" /><stop offset="1" stopColor="#E08B2C" />
        </linearGradient>
      </defs>
      <Sol rx={30} />
      <rect x="34" y="18" width="52" height="10" rx="5" fill="url(#v-bois)" />
      <rect x="34" y="92" width="52" height="10" rx="5" fill="url(#v-bois)" />
      <path d="M42 28h36c0 14-13 18-13 32s13 18 13 32H42c0-14 13-18 13-32s-13-18-13-32Z" fill="url(#v-verre)" />
      {/* le sable : plein en haut qui s'écoule, tas en bas */}
      <path d="M46.5 32h27c-.6 9-11 14-13.5 22-2.5-8-12.9-13-13.5-22Z" fill="url(#v-sable)" />
      <rect x="59" y="55" width="2.4" height="24" rx="1.2" fill="#E8A03A" />
      <path d="M48 88h24c-1.6-8-9-11-12-16-3 5-10.4 8-12 16Z" fill="url(#v-sable)" />
      <path d="M45 30h4c0 13 10 18 10 30s-10 19-10 30h-4c0-14 12-18 12-30s-12-17-12-30Z" fill="#FFFFFF" fillOpacity=".55" />
    </Cadre>
  );
}

/* ── Planifiés : un calendrier vu de trois quarts ─────────────────────────── */

export function VolCalendrier(p: PropsVolume) {
  return (
    <Cadre {...p}>
      <defs>
        <linearGradient id="v-cal-face" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#E4E0F8" />
        </linearGradient>
        <linearGradient id="v-cal-tete" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8B7BF0" /><stop offset="1" stopColor="#5A48C9" />
        </linearGradient>
        <linearGradient id="v-cal-tranche" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#B9AEEA" /><stop offset="1" stopColor="#8477CE" />
        </linearGradient>
      </defs>
      <Sol rx={34} />
      <g transform="rotate(-7 60 60)">
        <path d="M88 26v70l6-6V22Z" fill="url(#v-cal-tranche)" />
        <rect x="26" y="26" width="62" height="70" rx="11" fill="url(#v-cal-face)" />
        <path d="M26 37a11 11 0 0 1 11-11h40a11 11 0 0 1 11 11v6H26Z" fill="url(#v-cal-tete)" />
        <rect x="38" y="16" width="7" height="18" rx="3.5" fill="#4A3BA8" />
        <rect x="69" y="16" width="7" height="18" rx="3.5" fill="#4A3BA8" />
        {[0, 1, 2].map(l => [0, 1, 2, 3].map(c => (
          <rect key={`${l}-${c}`} x={35 + c * 13} y={53 + l * 13} width="8" height="8" rx="2.6"
                fill={l === 1 && c === 2 ? "#BDF2A0" : "#CFC8EC"} />
        )))}
      </g>
    </Cadre>
  );
}

/* ── Clients actifs : des pastilles de marque qui se chevauchent ──────────── */

export function VolClients(p: PropsVolume) {
  return (
    <Cadre {...p}>
      <defs>
        <radialGradient id="v-b1" cx="0.3" cy="0.25" r="0.9">
          <stop offset="0" stopColor="#8FE8C4" /><stop offset="1" stopColor="#159D74" />
        </radialGradient>
        <radialGradient id="v-b2" cx="0.3" cy="0.25" r="0.9">
          <stop offset="0" stopColor="#F6C08A" /><stop offset="1" stopColor="#B96A22" />
        </radialGradient>
        <radialGradient id="v-b3" cx="0.3" cy="0.25" r="0.9">
          <stop offset="0" stopColor="#D9F8C7" /><stop offset="1" stopColor="#7CC155" />
        </radialGradient>
      </defs>
      <Sol cx={54} rx={34} ry={7} />
      <circle cx="32" cy="64" r="21" fill="url(#v-b2)" />
      <circle cx="32" cy="64" r="21" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeOpacity=".85" />
      <ellipse cx="26" cy="55" rx="8" ry="5" fill="#FFFFFF" fillOpacity=".4" transform="rotate(-28 26 55)" />
      <circle cx="56" cy="52" r="24" fill="url(#v-b1)" />
      <circle cx="56" cy="52" r="24" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeOpacity=".9" />
      <ellipse cx="48" cy="42" rx="9" ry="5.5" fill="#FFFFFF" fillOpacity=".45" transform="rotate(-28 48 42)" />
      <circle cx="79" cy="68" r="18" fill="url(#v-b3)" />
      <circle cx="79" cy="68" r="18" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeOpacity=".85" />
      <ellipse cx="74" cy="61" rx="6.5" ry="4" fill="#FFFFFF" fillOpacity=".5" transform="rotate(-28 74 61)" />
    </Cadre>
  );
}
