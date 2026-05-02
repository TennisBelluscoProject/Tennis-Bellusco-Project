import { GoalCategory, GoalStatus, SurfaceType, MatchResult } from './database.types';

export const CATEGORY_CONFIG: Record<GoalCategory, { label: string; icon: string; color: string; bg: string }> = {
  tecnica: { label: 'Tecnica', icon: 'racquet', color: '#C41E3A', bg: '#F8E8EB' },
  tattica: { label: 'Tattica', icon: 'brain', color: '#1B3A5C', bg: '#E8EDF2' },
  fisico: { label: 'Fisico/Motori', icon: 'dumbbell', color: '#2E7D32', bg: '#E8F5E9' },
  mente: { label: 'Mente', icon: 'sparkles', color: '#7B1FA2', bg: '#F3E5F5' },
  agonismo: { label: 'Agonismo', icon: 'trophy', color: '#E65100', bg: '#FFF3E0' },
};

export const STATUS_CONFIG: Record<GoalStatus, { label: string; labelIt: string }> = {
  planned: { label: 'Planned', labelIt: 'In Programma' },
  in_progress: { label: 'In Progress', labelIt: 'In Corso' },
  completed: { label: 'Completed', labelIt: 'Conclusi' },
};

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
 *   - U10: ≤10 years
 *   - U12: 11–12
 *   - U14: 13–14
 *   - U16: 15–16
 *   - U18: 17–18
 *   - Open: 19–34
 *   - Over X: from 35, in 5-year buckets (35–39 → Over 35, 40–44 → Over 40, …)
 *   - Capped at Over 80 for ages ≥80.
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
