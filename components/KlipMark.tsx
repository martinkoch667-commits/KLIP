"use client";

// Marque « Klip » : baguette dans un disque blanc, cerclé du dégradé de la
// charte. C'est le même signe pour « Demander à Klip » sur un calque et pour
// l'assistant visuel en bas d'écran — un seul composant, pour qu'ils ne
// puissent pas diverger.
export default function KlipMark({ size = 22 }: { size?: number }) {
  const disc = Math.round(size * 0.68);
  const icon = Math.round(size * 0.47);
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'conic-gradient(from 120deg,#2FD79B,#BDF2A0,#2FD79B)',
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}
    >
      <span style={{ width: disc, height: disc, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center' }}>
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="#14160F" strokeWidth="2.2" strokeLinecap="round">
          <path d="M15 4V2M15 14v-2M8 9h2M20 9h2M17.6 11.6l1.4 1.4M17.6 6.4l1.4-1.4M4 21l10-10" />
        </svg>
      </span>
    </span>
  );
}
