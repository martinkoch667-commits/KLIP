// icons.tsx — set d'icônes SVG du module Montage (sous-ensemble VIcon du design KLIP)

export function VIcon({ name, size = 18 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "video": return <svg {...p}><rect x="2.5" y="5.5" width="13" height="13" rx="3" /><path d="M15.5 9.5l6-3v11l-6-3" /></svg>;
    case "image": return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M21 16l-5-5L5 20" /></svg>;
    case "text": return <svg {...p}><path d="M5 6.5V5h14v1.5M12 5v14M9 19h6" /></svg>;
    case "captions": return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M9 10.5a2.2 2.2 0 0 0-3 2 2.2 2.2 0 0 0 3 2M16 10.5a2.2 2.2 0 0 0-3 2 2.2 2.2 0 0 0 3 2" /></svg>;
    case "music": return <svg {...p}><path d="M9 18V6l11-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>;
    case "mic": return <svg {...p}><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7" /></svg>;
    case "transition": return <svg {...p}><rect x="2.5" y="6" width="8" height="12" rx="2" /><rect x="13.5" y="6" width="8" height="12" rx="2" /><path d="M11 12h2M11 9.5l2 2.5-2 2.5" /></svg>;
    case "filter": return <svg {...p}><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" /></svg>;
    case "speed": return <svg {...p}><path d="M5 19a9 9 0 1 1 14 0" /><path d="M12 13l4-3" /><circle cx="12" cy="13" r="1.2" fill="currentColor" stroke="none" /></svg>;
    case "sticker": return <svg {...p}><path d="M20 13a7 7 0 1 1-9-9v0a2 2 0 0 0 0 4 2 2 0 0 1 2 2 2 2 0 0 0 4 0 2 2 0 0 1 3-1Z" /></svg>;
    case "scissors": return <svg {...p}><circle cx="6" cy="6" r="2.6" /><circle cx="6" cy="18" r="2.6" /><path d="M8.2 7.6L20 18M8.2 16.4L20 6" /></svg>;
    case "play": return <svg {...p}><path d="M7 5l12 7-12 7V5Z" fill="currentColor" stroke="none" /></svg>;
    case "pause": return <svg {...p}><rect x="6" y="5" width="4" height="14" rx="1.3" fill="currentColor" stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1.3" fill="currentColor" stroke="none" /></svg>;
    case "chevL": return <svg {...p}><path d="M15 6l-6 6 6 6" /></svg>;
    case "chevR": return <svg {...p}><path d="M9 6l6 6-6 6" /></svg>;
    case "undo": return <svg {...p}><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1" /></svg>;
    case "redo": return <svg {...p}><path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h1" /></svg>;
    case "eye": return <svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>;
    case "eyeOff": return <svg {...p}><path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-3.2 3.9M6.1 6.1A15.7 15.7 0 0 0 2 12s3.5 7 10 7a9.4 9.4 0 0 0 4.1-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M3 3l18 18" /></svg>;
    case "link": return <svg {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>;
    case "unlink": return <svg {...p}><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2" /><path d="M3 3l18 18" /></svg>;
    case "upload": return <svg {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" /></svg>;
    case "export": return <svg {...p}><path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" /></svg>;
    case "trash": return <svg {...p}><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13" /></svg>;
    case "copy": return <svg {...p}><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>;
    case "sparkles": return <svg {...p}><path d="M12 3l1.5 5L19 9.5 13.5 11 12 16l-1.5-5L5 9.5 10.5 8 12 3Z" /><path d="M18 15l.7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z" /></svg>;
    case "split": return <svg {...p}><path d="M12 3v18M7 8l-3 4 3 4M17 8l3 4-3 4" /></svg>;
    case "crop": return <svg {...p}><path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14" /></svg>;
    case "plus": return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
    case "reorder": return <svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case "lasso": return <svg {...p}><path d="M3 11a9 5 0 1 1 12 4.6" /><path d="M5 16.5a1.8 1.8 0 1 0 2.6 2.3c.6 1 .2 2.2-.6 2.2" /><circle cx="11" cy="11" r="2.4" /></svg>;
    case "zoomIn": return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4M11 8v6M8 11h6" /></svg>;
    case "zoomOut": return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4M8 11h6" /></svg>;
    case "volume": return <svg {...p}><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4Z" /><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" opacity=".7" /></svg>;
    case "mute": return <svg {...p}><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4Z" /><path d="M17 9.5l4 5M21 9.5l-4 5" /></svg>;
    case "calendar": return <svg {...p}><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>;
    case "check": return <svg {...p}><path d="M4 12.5l5 5 11-11" /></svg>;
    case "alert": return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.2v.3" /></svg>;
    case "x": return <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case "rows": return <svg {...p}><rect x="3.5" y="4.5" width="17" height="6" rx="1.5" /><rect x="3.5" y="13.5" width="17" height="6" rx="1.5" /></svg>;
    case "lock": return <svg {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>;
    case "dots": return <svg {...p}><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>;
    default: return null;
  }
}
