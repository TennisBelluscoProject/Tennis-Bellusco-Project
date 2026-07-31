/**
 * ╭──────────────────────────────────────────────────────────────────────╮
 * │  PERCORSI KIDS — ESPERIENZA E LIVELLI                                 │
 * ╰──────────────────────────────────────────────────────────────────────╯
 *
 * L'allievo non vede "8 obiettivi su 12": vede PUNTI ESPERIENZA e LIVELLI.
 *
 * DUE CURVE, ENTRAMBE CRESCENTI
 *
 *  1. Quanto VALE un obiettivo. Piu' si e' avanti nel percorso, piu' ogni
 *     obiettivo pesa: al passo 1 vale 10 XP, al passo 12 ne vale 32.
 *
 *         xp(passo) = 10 + (passo - 1) * 2
 *
 *  2. Quanto COSTA un livello. Ogni livello richiede piu' esperienza del
 *     precedente: dal livello 1 al 2 servono 40 XP, dal 2 al 3 ne servono
 *     44, e cosi' via.
 *
 *         costo(livello) = 40 + (livello - 1) * 4
 *
 *     Le due curve insieme fanno si' che il ritmo di salita resti costante
 *     nella percezione: gli obiettivi valgono di piu' proprio mentre i
 *     livelli costano di piu'.
 *
 * IL LUCCHETTO E' UNA SOGLIA DI LIVELLO
 *
 * Ogni 2 passi c'e' un cancello che si apre "al livello N". N non e' un
 * numero inventato: e' esattamente il livello che si raggiunge completando
 * tutti gli obiettivi di quella coppia di passi (vedi `gateLevel` in
 * progress.ts). Quindi la regola di sblocco e' la stessa di prima —
 * completare la pagina del libretto — ma raccontata come progressione di
 * livello, che e' molto piu' motivante per un bambino.
 *
 * File PURO: solo matematica, nessun React e nessun Supabase.
 */

// ─── Curva 1: valore di un obiettivo ────────────────────────────────────────

/** XP di un obiettivo del primo passo. */
export const XP_BASE = 10;
/** Quanto cresce il valore di un obiettivo a ogni passo. */
export const XP_PER_STEP = 2;

/** Quanti XP vale un obiettivo che si trova al passo indicato (1..12). */
export function xpForObjective(stepNumber: number): number {
  const s = Math.max(1, Math.floor(stepNumber));
  return XP_BASE + (s - 1) * XP_PER_STEP;
}

// ─── Curva 2: costo dei livelli ─────────────────────────────────────────────

/** XP per passare dal livello 1 al 2. */
export const LEVEL_BASE = 40;
/** Quanto rincara ogni livello successivo. */
export const LEVEL_GROWTH = 4;

/** XP necessari per passare da `level` a `level + 1`. */
export function xpForLevelUp(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return LEVEL_BASE + (l - 1) * LEVEL_GROWTH;
}

/**
 * XP cumulativi necessari per RAGGIUNGERE un livello.
 * Il livello 1 e' il punto di partenza, quindi costa 0.
 *
 * Forma chiusa della somma dei costi: evita di ciclare.
 */
export function xpToReachLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  const n = l - 1;
  return LEVEL_BASE * n + (LEVEL_GROWTH * n * (n - 1)) / 2;
}

export interface LevelInfo {
  /** Livello attuale (parte da 1). */
  level: number;
  /** XP totali accumulati. */
  xp: number;
  /** XP gia' accumulati DENTRO il livello attuale. */
  xpIntoLevel: number;
  /** XP che servono per completare il livello attuale. */
  xpForNextLevel: number;
  /** Avanzamento dentro il livello attuale, 0..100. */
  percent: number;
}

/**
 * Livello corrispondente a una quantita' di esperienza.
 *
 * Si potrebbe invertire la formula quadratica, ma un ciclo e' piu' leggibile
 * e qui i livelli sono poche decine: il costo e' irrilevante.
 */
export function levelForXp(xp: number): LevelInfo {
  const total = Math.max(0, Math.floor(xp));
  let level = 1;
  let consumed = 0;

  // Cintura di sicurezza sul numero di iterazioni: nessun percorso arriva
  // vicino al livello 500, ma un ciclo senza limite non si scrive mai.
  while (level < 500) {
    const cost = xpForLevelUp(level);
    if (consumed + cost > total) break;
    consumed += cost;
    level += 1;
  }

  const xpForNextLevel = xpForLevelUp(level);
  const xpIntoLevel = total - consumed;

  return {
    level,
    xp: total,
    xpIntoLevel,
    xpForNextLevel,
    percent: xpForNextLevel > 0 ? Math.round((xpIntoLevel / xpForNextLevel) * 100) : 0,
  };
}
