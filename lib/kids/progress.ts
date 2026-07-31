/**
 * ╭──────────────────────────────────────────────────────────────────────╮
 * │  PERCORSI KIDS — STATO DEL PERCORSO (funzione pura)                   │
 * ╰──────────────────────────────────────────────────────────────────────╯
 *
 * Il percorso e' una CATENA LINEARE di 12 PASSI, raggruppati due a due in 6
 * pagine del libretto. Da qui due granularita':
 *
 *   PASSO   unita' visiva del sentiero (12 nodi in stile Duolingo).
 *           Ogni passo possiede un sottoinsieme degli obiettivi della sua
 *           pagina (vedi splitStageIntoSteps in curriculum.ts).
 *
 *   PAGINA  unita' di SBLOCCO: la coppia di passi. Il cancello con la catena
 *           sta ogni 2 passi, come nel libretto.
 *
 * COME VIENE RACCONTATO ALL'ALLIEVO
 * Ogni obiettivo spuntato da PUNTI ESPERIENZA (di piu' man mano che si
 * avanza) e l'esperienza fa salire di LIVELLO (ogni livello costa piu' del
 * precedente — vedi xp.ts). Il cancello non dice "ti mancano 4 obiettivi"
 * ma "serve il livello 7": e' la stessa condizione, perche' `gateLevel` e'
 * calcolato come il livello che si raggiunge completando esattamente tutti
 * gli obiettivi di quella pagina.
 *
 * Regola di sblocco (una sola passata):
 *
 *     pagina[0] e' sempre sbloccata
 *     pagina[i] e' sbloccata  ⇔  pagina[i-1] ha TUTTI gli obiettivi spuntati
 *
 * I due passi di una pagina si sbloccano insieme: dentro la coppia si puo'
 * lavorare nell'ordine che si preferisce.
 *
 * Questo file non conosce React ne' Supabase.
 */

import type { PlayerLevel } from '@/lib/database.types';
import {
  KIDS_PROGRAMS,
  kidsNextLevel,
  splitStageIntoSteps,
  type KidsAreaBlock,
  type KidsObjective,
  type KidsProgram,
  type KidsStage,
} from './curriculum';
import { levelForXp, xpForObjective, type LevelInfo } from './xp';

// ─── Tipi del risultato ─────────────────────────────────────────────────────

/** Un singolo PASSO del sentiero (1..12). */
export interface KidsStepState {
  /** Numero del passo mostrato all'allievo, da 1 a 12. */
  number: number;
  /** Indice della pagina di appartenenza (0..5). */
  stageIndex: number;
  /** 0 = primo passo della pagina, 1 = secondo. */
  half: 0 | 1;
  /** La pagina del libretto da cui proviene. */
  stage: KidsStage;
  /** Le aree assegnate a QUESTO passo. */
  areas: KidsAreaBlock[];
  objectives: KidsObjective[];
  total: number;
  done: number;
  /** 0..100 */
  percent: number;
  completed: boolean;
  /** Accessibile: dipende dalla pagina, non dal singolo passo. */
  unlocked: boolean;
  /** Primo passo sbloccato e non completato: e' dove sta l'avatar. */
  current: boolean;
  /** Stadio dell'avatar (cambia ogni 4 passi). */
  tier: 0 | 1 | 2;
  /** Quanto vale un singolo obiettivo di questo passo. */
  xpPerObjective: number;
  /** XP ottenibili completando tutto il passo. */
  xpTotal: number;
  /** XP gia' guadagnati in questo passo. */
  xpDone: number;
  /** true se subito dopo c'e' il cancello con la catena (passi pari). */
  gateAfter: boolean;
  /** Il cancello dopo questo passo e' aperto. */
  gateOpen: boolean;
  /** Livello richiesto per aprire quel cancello (null se non c'e' cancello). */
  gateLevel: number | null;
}

/** Una PAGINA del libretto = coppia di passi. */
export interface KidsStageState {
  stage: KidsStage;
  index: number;
  total: number;
  done: number;
  percent: number;
  completed: boolean;
  unlocked: boolean;
  current: boolean;
  tier: 0 | 1 | 2;
  /** Livello raggiunto completando questa pagina: e' la chiave del cancello. */
  gateLevel: number;
}

export interface KidsProgramState {
  program: KidsProgram;
  /** I 12 passi del sentiero, in ordine. */
  steps: KidsStepState[];
  /** Le 6 pagine (coppie di passi): unita' di sblocco. */
  stages: KidsStageState[];
  totalObjectives: number;
  doneObjectives: number;
  percent: number;
  completedStages: number;
  /** Numero di PASSI conclusi (0..12). */
  completedSteps: number;
  finished: boolean;
  currentStepIndex: number;
  currentStageIndex: number;
  tier: 0 | 1 | 2;
  nextLevel: PlayerLevel | null;

  // ─── Esperienza e livelli ───
  /** XP guadagnati finora. */
  xp: number;
  /** XP ottenibili completando tutto il percorso. */
  xpTotal: number;
  /** Livello attuale e avanzamento dentro il livello. */
  levelInfo: LevelInfo;
  /** Livello che si raggiunge concludendo il percorso. */
  maxLevel: number;
  /**
   * Livelli a cui l'avatar si evolve: [1, livello dopo 4 passi, dopo 8 passi].
   * Serve per annunciare "prossima evoluzione al livello N".
   */
  tierLevels: [number, number, number];
}

// ─── Avatar: cambia ogni 4 passi, cioe' ogni 2 pagine ───────────────────────

export function kidsTierForStage(stageIndex: number): 0 | 1 | 2 {
  const t = Math.floor(Math.max(0, stageIndex) / 2);
  return (t > 2 ? 2 : t) as 0 | 1 | 2;
}

/** Stessa regola espressa in numero di passo (1..12). */
export function kidsTierForStep(stepNumber: number): 0 | 1 | 2 {
  return kidsTierForStage(Math.floor((Math.max(1, stepNumber) - 1) / 2));
}

// ─── Calcolo dello stato ────────────────────────────────────────────────────

export function computeKidsState(
  program: KidsProgram,
  doneKeys: ReadonlySet<string>
): KidsProgramState {
  const stages: KidsStageState[] = [];
  const steps: KidsStepState[] = [];

  let previousCompleted = true; // la prima pagina e' sempre accessibile
  let totalObjectives = 0;
  let doneObjectives = 0;
  let completedStages = 0;
  let completedSteps = 0;
  let currentStageIndex = -1;
  let currentStepIndex = -1;

  // XP: `xpTotal` accumula il massimo ottenibile, `xp` quanto e' stato preso.
  let xp = 0;
  let xpTotal = 0;
  /** XP massimi accumulati fino alla fine di ciascuna pagina. */
  const xpCumulativeByStage: number[] = [];

  program.stages.forEach((stage, index) => {
    const total = stage.objectives.length;
    const done = stage.objectives.reduce((n, o) => n + (doneKeys.has(o.key) ? 1 : 0), 0);
    const completed = total > 0 && done === total;
    const unlocked = previousCompleted;
    const tier = kidsTierForStage(index);

    const current = unlocked && !completed && currentStageIndex === -1;
    if (current) currentStageIndex = index;

    // I due passi della pagina.
    const halves = splitStageIntoSteps(stage);
    halves.forEach((half, h) => {
      const number = stage.steps[h];
      const xpPerObjective = xpForObjective(number);
      const sTotal = half.objectives.length;
      const sDone = half.objectives.reduce((n, o) => n + (doneKeys.has(o.key) ? 1 : 0), 0);
      const sCompleted = sTotal > 0 && sDone === sTotal;
      if (sCompleted) completedSteps += 1;

      xpTotal += sTotal * xpPerObjective;
      xp += sDone * xpPerObjective;

      steps.push({
        number,
        stageIndex: index,
        half: h as 0 | 1,
        stage,
        areas: half.areas,
        objectives: half.objectives,
        total: sTotal,
        done: sDone,
        percent: sTotal > 0 ? Math.round((sDone / sTotal) * 100) : 0,
        completed: sCompleted,
        unlocked,
        current: false, // assegnato sotto, a sequenza nota
        tier,
        xpPerObjective,
        xpTotal: sTotal * xpPerObjective,
        xpDone: sDone * xpPerObjective,
        gateAfter: h === 1 && index < program.stages.length - 1,
        gateOpen: completed,
        gateLevel: null, // assegnato sotto
      });
    });

    xpCumulativeByStage[index] = xpTotal;

    stages.push({
      stage,
      index,
      total,
      done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
      completed,
      unlocked,
      current,
      tier,
      // Il livello che si raggiunge avendo completato tutto fino a qui.
      gateLevel: levelForXp(xpTotal).level,
    });

    totalObjectives += total;
    doneObjectives += done;
    if (completed) completedStages += 1;

    // `completed && unlocked` evita che una pagina spuntata fuori ordine
    // (dato incoerente) sblocchi le successive.
    previousCompleted = completed && unlocked;
  });

  // Soglia di livello di ogni cancello.
  for (const s of steps) {
    if (s.gateAfter) s.gateLevel = stages[s.stageIndex].gateLevel;
  }

  // Passo corrente: il primo sbloccato e non concluso.
  const idx = steps.findIndex((s) => s.unlocked && !s.completed);
  if (idx >= 0) {
    steps[idx].current = true;
    currentStepIndex = idx;
  }

  const finished = completedStages === program.stages.length;

  // Evoluzioni dell'avatar: si entra nel tier 1 dopo 4 passi (fine pagina 2)
  // e nel tier 2 dopo 8 passi (fine pagina 4).
  const tierLevels: [number, number, number] = [
    1,
    levelForXp(xpCumulativeByStage[1] ?? 0).level,
    levelForXp(xpCumulativeByStage[3] ?? 0).level,
  ];

  return {
    program,
    steps,
    stages,
    totalObjectives,
    doneObjectives,
    percent: totalObjectives > 0 ? Math.round((doneObjectives / totalObjectives) * 100) : 0,
    completedStages,
    completedSteps,
    finished,
    currentStepIndex: finished ? -1 : currentStepIndex,
    currentStageIndex: finished ? -1 : currentStageIndex,
    tier: finished ? 2 : kidsTierForStage(currentStageIndex === -1 ? 0 : currentStageIndex),
    nextLevel: kidsNextLevel(program.level),
    xp,
    xpTotal,
    levelInfo: levelForXp(xp),
    maxLevel: levelForXp(xpTotal).level,
    tierLevels,
  };
}

/** Scorciatoia: stato a partire dal livello invece che dal percorso. */
export function computeKidsStateForLevel(
  level: PlayerLevel,
  doneKeys: ReadonlySet<string>
): KidsProgramState {
  return computeKidsState(KIDS_PROGRAMS[level], doneKeys);
}
