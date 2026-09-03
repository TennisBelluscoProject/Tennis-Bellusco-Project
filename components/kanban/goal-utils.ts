import type { Goal, GoalStatus } from '@/lib/database.types';
import { STATUS_COLUMNS } from '@/lib/constants';

/* ─────────────────────────────────────────────────────────────────────────
   Piccoli calcoli condivisi da card, foglio di dettaglio e board.
   Stanno fuori dai componenti perche' li usano tutti e tre, e perche' cosi'
   sono verificabili senza montare niente.
   ───────────────────────────────────────────────────────────────────────── */

export interface Deadline {
  days: number;
  label: string;
  tone: 'late' | 'soon' | 'calm';
}

/**
 * Scadenza in forma leggibile.
 *
 * `today` e' un parametro e non `Date.now()` letto qui dentro: durante il
 * render deve valere lo stesso istante per tutte le card, altrimenti due
 * obiettivi con la stessa data possono finire su giorni diversi se il
 * render attraversa la mezzanotte.
 */
export function describeDeadline(deadline: string | null, today: number): Deadline | null {
  if (!deadline) return null;
  const target = new Date(deadline).getTime();
  if (Number.isNaN(target)) return null;

  const days = Math.ceil((target - today) / 86_400_000);

  if (days < 0) {
    const n = Math.abs(days);
    return { days, tone: 'late', label: n === 1 ? 'scaduto ieri' : `scaduto ${n} giorni fa` };
  }
  if (days === 0) return { days, tone: 'soon', label: 'scade oggi' };
  if (days === 1) return { days, tone: 'soon', label: 'scade domani' };
  if (days <= 7) return { days, tone: 'soon', label: `${days} giorni` };
  return { days, tone: 'calm', label: `${days} giorni` };
}

export function deadlineColor(tone: Deadline['tone']): string {
  if (tone === 'late') return 'var(--destructive)';
  if (tone === 'soon') return 'var(--warning)';
  return 'var(--subtle-foreground)';
}

export function nextStatus(status: GoalStatus): GoalStatus | null {
  const i = STATUS_COLUMNS.indexOf(status);
  return i >= 0 && i < STATUS_COLUMNS.length - 1 ? STATUS_COLUMNS[i + 1] : null;
}

export function prevStatus(status: GoalStatus): GoalStatus | null {
  const i = STATUS_COLUMNS.indexOf(status);
  return i > 0 ? STATUS_COLUMNS[i - 1] : null;
}

/**
 * Applica un cambio di stato alla copia in memoria, esattamente come lo
 * applica `SupabaseGoalRepository.changeStatus` sul database.
 *
 * Serve all'aggiornamento ottimistico: la card si sposta subito, e quando la
 * risposta arriva non deve "correggersi" saltando. Le due regole implicite
 * (concluso = 100%, in programma = 0%) sono ripetute qui apposta; se una
 * delle due cambia nel repository, va cambiata anche qui, altrimenti si vede
 * un guizzo al ritorno della risposta.
 */
export function applyStatus(goal: Goal, status: GoalStatus): Goal {
  const now = new Date().toISOString();
  if (status === 'completed') {
    return { ...goal, status, progress: 100, completed_at: now, updated_at: now };
  }
  if (status === 'planned') {
    return { ...goal, status, progress: 0, completed_at: null, updated_at: now };
  }
  return { ...goal, status, completed_at: null, updated_at: now };
}
