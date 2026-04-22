import { GoalCategory, GoalStatus, SurfaceType, MatchResult } from './database.types';

export const CATEGORY_CONFIG: Record<GoalCategory, { label: string; icon: string; color: string; bg: string }> = {
  tecnica: { label: 'Tecnica', icon: '🎾', color: '#C41E3A', bg: '#F8E8EB' },
  tattica: { label: 'Tattica', icon: '🧠', color: '#1B3A5C', bg: '#E8EDF2' },
  fisico: { label: 'Fisico', icon: '💪', color: '#2E7D32', bg: '#E8F5E9' },
  mente: { label: 'Mente', icon: '🧘', color: '#7B1FA2', bg: '#F3E5F5' },
  agonismo: { label: 'Agonismo', icon: '🏆', color: '#E65100', bg: '#FFF3E0' },
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

export const LEVELS = ['Principiante', 'Intermedio', 'Avanzato'] as const;

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
  const level = profile.level || 'Principiante';
  const ranking = profile.ranking || 'Non classificato';

  // Check if the level field contains what looks like a FIT ranking (a number like "4.1")
  const levelLooksLikeRanking = /^\d+(\.\d+)?$/.test(level.trim());
  const rankingIsDefault = ranking === 'Non classificato' || !ranking.trim();

  if (levelLooksLikeRanking && rankingIsDefault) {
    // The ranking was saved in the level field by mistake
    return {
      displayLevel: 'Principiante',
      displayRanking: level.trim(),
    };
  }

  return {
    displayLevel: level,
    displayRanking: ranking,
  };
}
