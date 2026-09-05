import { GoalCategory, GoalStatus, SurfaceType, MatchResult } from './database.types';

/**
 * Colori di dominio.
 *
 * Sono variabili CSS, non esadecimali: i valori veri stanno in globals.css e
 * cambiano fra tema chiaro e scuro. Se restassero fissi qui, ogni pastello
 * pensato per il fondo bianco andrebbe rifatto a mano per quello scuro — e
 * prima o poi qualcuno se ne dimenticherebbe uno.
 *
 * Nota per chi tocca il codice: NON concatenare (`${color}15` per ottenere
 * l'alfa) — su una var() non funziona. Si usa `withAlpha()` qui sotto.
 */
export const CATEGORY_CONFIG: Record<GoalCategory, { label: string; short: string; icon: string; color: string; bg: string }> = {
  tecnica:  { label: 'Tecnica',        short: 'Tec', icon: 'racquet',  color: 'var(--cat-tecnica)',  bg: 'var(--cat-tecnica-soft)' },
  tattica:  { label: 'Tattica',        short: 'Tat', icon: 'brain',    color: 'var(--cat-tattica)',  bg: 'var(--cat-tattica-soft)' },
  fisico:   { label: 'Fisico/Motori',  short: 'Fis', icon: 'dumbbell', color: 'var(--cat-fisico)',   bg: 'var(--cat-fisico-soft)' },
  mente:    { label: 'Mente',          short: 'Men', icon: 'sparkles', color: 'var(--cat-mente)',    bg: 'var(--cat-mente-soft)' },
  agonismo: { label: 'Agonismo',       short: 'Ago', icon: 'trophy',   color: 'var(--cat-agonismo)', bg: 'var(--cat-agonismo-soft)' },
};

export const STATUS_CONFIG: Record<
  GoalStatus,
  { label: string; labelIt: string; short: string; color: string; soft: string }
> = {
  planned:     { label: 'Planned',     labelIt: 'In programma', short: 'Programma', color: 'var(--status-planned)',   soft: 'var(--status-planned-soft)' },
  in_progress: { label: 'In Progress', labelIt: 'In corso',     short: 'In corso',  color: 'var(--status-progress)',  soft: 'var(--status-progress-soft)' },
  completed:   { label: 'Completed',   labelIt: 'Conclusi',     short: 'Conclusi',  color: 'var(--status-completed)', soft: 'var(--status-completed-soft)' },
};

/**
 * Versione trasparente di un colore, che funziona anche sulle variabili CSS.
 * `color-mix` e' supportato da tutti i browser che reggono questa app.
 */
export function withAlpha(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

export const STATUS_COLUMNS: GoalStatus[] = ['planned', 'in_progress', 'completed'];

export const SURFACE_LABELS: Record<SurfaceType, string> = {
  terra_rossa: 'Terra rossa',
  erba: 'Erba',
  cemento: 'Cemento',
  sintetico: 'Sintetico',
};

export const RESULT_LABELS: Record<MatchResult, string> = {
  win: 'Vittoria',
  loss: 'Sconfitta',
  retired: 'Ritirato',
  walkover: 'Walkover',
};

export const LEVELS = ['DELFINO', 'CERBIATTO', 'COCCODRILLO'] as const;

/**
 * Le classifiche ufficiali FIT, dalla piu' bassa alla piu' alta.
 *
 * Prima qui si scriveva a mano in un campo di testo libero, e infatti nel
 * database convivono valori validi, valori inventati e refusi: la classifica
 * decide la categoria d'eta' mostrata e chi conta come "classificato"
 * (`isClassified`), quindi un "4,3" con la virgola o un "4.7" che non esiste
 * si portano dietro dei conti sbagliati.
 *
 * `4.NC` non compare: quel caso e' gia' coperto dalla casella "Non
 * classificato FIT", che scrive `Non classificato` — il valore che tutto il
 * resto dell'app si aspetta.
 */
export const FIT_RANKING_GROUPS: { categoria: string; valori: string[] }[] = [
  { categoria: 'Quarta categoria', valori: ['4.6', '4.5', '4.4', '4.3', '4.2', '4.1'] },
  { categoria: 'Terza categoria', valori: ['3.5', '3.4', '3.3', '3.2', '3.1'] },
  { categoria: 'Seconda categoria', valori: ['2.8', '2.7', '2.6', '2.5', '2.4', '2.3', '2.2', '2.1'] },
  { categoria: 'Prima categoria', valori: ['1.1'] },
];

/** Le stesse classifiche in un elenco piatto, per i controlli di validita'. */
export const FIT_RANKINGS: string[] = FIT_RANKING_GROUPS.flatMap((g) => g.valori);

/** Vero se la stringa e' una classifica FIT che esiste davvero. */
export function isValidFitRanking(v: string | null | undefined): boolean {
  return !!v && FIT_RANKINGS.includes(v.trim());
}

// Feature flag — mostra la tab "Il mio percorso" (anteprima Iterazione A, su
// dati di esempio). Impostare a `false` per nasconderla agli utenti reali
// finche' l'Iterazione B (attivazione + materializzazione) non e' completa.
export const PATHS_PREVIEW = true;

// Feature flag — mostra la sezione "Percorsi Kids" (i 12 passi del Diario del
// Tennis) nel catalogo del maestro e nella scheda dell'allievo.
// Richiede la migrazione scripts/sql/2026_kids_paths.sql.
export const KIDS_PATHS = true;

export const ROUNDS = [
  'Primo turno', 'Secondo turno', 'Terzo turno',
  'Ottavi di finale', 'Quarti di finale', 'Semifinale', 'Finale',
] as const;

/**
 * Helper to determine the correct display values for level and ranking.
 * Some profiles have the FIT ranking stored in `level` instead of `ranking`.
 * A FIT ranking looks like a number (e.g. "4.1", "3.5", "2.8").
 */
export function getDisplayRanking(profile: { level: string | null; ranking: string | null }): {
  displayLevel: string;
  displayRanking: string;
} {
  const level = profile.level || 'DELFINO';
  const ranking = profile.ranking || 'Non classificato';

  // Check if the level field contains what looks like a FIT ranking (a number like "4.1")
  const levelLooksLikeRanking = /^\d+(\.\d+)?$/.test(level.trim());
  const rankingIsDefault = ranking === 'Non classificato' || !ranking.trim();

  if (levelLooksLikeRanking && rankingIsDefault) {
    // The ranking was saved in the level field by mistake
    return {
      displayLevel: 'DELFINO',
      displayRanking: level.trim(),
    };
  }

  return {
    displayLevel: level,
    displayRanking: ranking,
  };
}

/**
 * Returns true if the player is FIT-classified (has a numeric ranking).
 * Players that are "Non classificato" (or have no ranking) are not classified.
 */
export function isClassified(ranking: string | null | undefined): boolean {
  if (!ranking) return false;
  const r = ranking.trim();
  if (!r) return false;
  if (r.toLowerCase() === 'non classificato') return false;
  return /^\d+(\.\d+)?$/.test(r);
}

/**
 * Compute current age (in years) from a birth date string (YYYY-MM-DD).
 */
export function getAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

/**
 * FIT-style age category. Returns one of:
 *   U10, U12, U14, U16, U18, Open, Over 35, Over 40, ..., Over 80
 * or null if birth_date is missing/invalid.
 *
 * Brackets:
 *   - U10: <=10 years
 *   - U12: 11-12
 *   - U14: 13-14
 *   - U16: 15-16
 *   - U18: 17-18
 *   - Open: 19-34
 *   - Over X: from 35, in 5-year buckets (35-39 -> Over 35, 40-44 -> Over 40, ...)
 *   - Capped at Over 80 for ages >=80.
 */
export function getAgeCategory(birthDate: string | null | undefined): string | null {
  const age = getAge(birthDate);
  if (age === null) return null;
  if (age <= 10) return 'U10';
  if (age <= 12) return 'U12';
  if (age <= 14) return 'U14';
  if (age <= 16) return 'U16';
  if (age <= 18) return 'U18';
  if (age <= 34) return 'NOR';
  const bucket = Math.min(80, Math.floor(age / 5) * 5);
  return `Over ${bucket}`;
}
