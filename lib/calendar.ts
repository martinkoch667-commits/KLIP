// Briques communes aux calendriers (planning d'un client, vue tous clients).
// Ce sont des fonctions pures : elles vivaient en double dans les pages, ce qui
// faisait diverger la grille d'un écran à l'autre.

export const HOUR_H = 48; // px par heure — créneaux lisibles, blocs proportionnels
export const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Date locale au format d'un <input type="date"> (jamais toISOString : UTC). */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function toTimeInput(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function buildScheduledAt(dateStr: string, timeStr: string): string | null {
  const d = new Date(`${dateStr}T${timeStr || "09:00"}:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Courbe d'affluence simulée (pics aux heures Instagram habituelles). */
export function engageScore(dayOfWeek: number, hour: number): number {
  const base: Record<number, number[]> = {
    1: [4,3,3,2,2,3,5,18,32,44,52,48,42,38,35,30,28,40,62,78,88,82,70,40],
    2: [4,3,3,2,2,3,6,20,35,48,55,50,45,40,38,34,30,44,65,80,90,84,72,42],
    3: [5,3,3,2,2,4,7,22,38,50,58,52,48,42,40,36,32,46,68,82,92,86,74,44],
    4: [5,3,3,2,2,4,6,20,36,48,55,50,46,40,38,34,30,44,66,80,90,84,72,42],
    5: [5,4,3,2,2,3,6,18,30,40,48,45,40,38,36,32,30,42,60,75,85,82,70,45],
    6: [6,4,3,3,2,3,5,14,22,30,38,42,46,50,52,54,55,58,65,72,78,75,62,48],
    0: [7,5,4,3,2,3,5,12,18,26,32,38,42,46,50,54,58,60,65,70,75,72,62,50],
  };
  const curve = base[dayOfWeek] ?? base[1];
  return curve[hour] ?? 5;
}

/** Teinte d'un créneau selon l'affluence (week-end atténué). */
export function slotHeat(dayOfWeek: number, hour: number): number {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  return Math.max(0, (engageScore(dayOfWeek, hour) - 40) / 60) * (isWeekend ? 0.5 : 1);
}

export const WS_COLORS = ["#7B5CF5", "#2FD79B", "#C8732B", "#5A86E8", "#DD2A7B", "#88B394", "#E8A03A", "#4A8DD4"];

export function wsColor(index: number): string {
  return WS_COLORS[index % WS_COLORS.length];
}

export function isVideoUrl(url?: string | null): boolean {
  return !!url && /\.(webm|mp4|mov|m4v|quicktime)(\?|$)/i.test(url);
}
