// ─── Generic UI helpers shared across the app ─────────

export function timeAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return 'ora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h fa`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}g fa`;
  if (d < 30) return `${Math.floor(d / 7)} sett fa`;
  if (d < 365) return `${Math.floor(d / 30)} mesi fa`;
  return `${Math.floor(d / 365)} anni fa`;
}

export function formatDateLong(d: Date): string {
  const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const months = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
  ];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

export function isActiveToday(activity: Date | null): boolean {
  if (!activity) return false;
  return Date.now() - activity.getTime() < 24 * 60 * 60 * 1000;
}

export function getActivityDot(lastActivity: Date | null): { color: string; bg: string; label: string } {
  if (!lastActivity) return { color: '#D1D5DB', bg: '#D1D5DB', label: 'Inattivo' };
  const ageMs = Date.now() - lastActivity.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (ageMs < day) return { color: '#16a34a', bg: '#16a34a', label: 'Attivo' };
  if (ageMs < 7 * day) return { color: '#E65100', bg: '#E65100', label: 'Inattivo recente' };
  return { color: '#D1D5DB', bg: '#D1D5DB', label: 'Inattivo' };
}

export function ageLabelFrom(createdAt: string): string {
  const ageMin = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (ageMin < 60) return `${ageMin}min fa`;
  if (ageMin < 60 * 24) return `${Math.floor(ageMin / 60)}h fa`;
  return `${Math.floor(ageMin / (60 * 24))}g fa`;
}
