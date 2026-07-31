import { describe, it, expect } from 'vitest';
import {
  KIDS_PROGRAMS,
  KIDS_PROGRAM_LIST,
  kidsAllKeys,
  kidsNextLevel,
  kidsTotalObjectives,
  kidsLevelOf,
  splitStageIntoSteps,
} from '../curriculum';
import { computeKidsState, kidsTierForStage, kidsTierForStep } from '../progress';
import {
  levelForXp,
  xpForLevelUp,
  xpForObjective,
  xpToReachLevel,
} from '../xp';

/**
 * Totali attesi per livello.
 *
 * Devono combaciare con la tabella `kids_level_totals` popolata da
 * scripts/sql/2026_kids_paths.sql: se qualcuno aggiunge o toglie un
 * obiettivo dal curriculum senza aggiornare la migrazione, questo test
 * fallisce e lo segnala prima che il passaggio di livello si rompa in
 * produzione.
 */
const TOTALI_MIGRAZIONE = { DELFINO: 87, CERBIATTO: 61, COCCODRILLO: 60 } as const;

type Livello = keyof typeof TOTALI_MIGRAZIONE;

/** Chiavi di tutti gli obiettivi delle prime N coppie di passi. */
function keysUpToStage(level: Livello, n: number): Set<string> {
  return new Set(
    KIDS_PROGRAMS[level].stages.slice(0, n).flatMap((s) => s.objectives.map((o) => o.key))
  );
}

// ════════════════════════════════════════════════════════════════════════════

describe('curriculum dei 12 passi', () => {
  it('ha tre percorsi da 6 pagine ciascuno', () => {
    expect(KIDS_PROGRAM_LIST).toHaveLength(3);
    for (const p of KIDS_PROGRAM_LIST) {
      expect(p.stages).toHaveLength(6);
      const passi = p.stages.flatMap((s) => s.steps);
      expect(passi).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    }
  });

  it('genera chiavi univoche per ogni obiettivo', () => {
    for (const p of KIDS_PROGRAM_LIST) {
      const keys = kidsAllKeys(p);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('non ha tappe vuote e ogni obiettivo ha un titolo', () => {
    for (const p of KIDS_PROGRAM_LIST) {
      for (const s of p.stages) {
        expect(s.objectives.length).toBeGreaterThan(0);
        for (const o of s.objectives) {
          expect(o.title.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('i totali combaciano con la migrazione SQL', () => {
    for (const [level, atteso] of Object.entries(TOTALI_MIGRAZIONE)) {
      expect(kidsTotalObjectives(KIDS_PROGRAMS[level as Livello])).toBe(atteso);
    }
  });

  it('normalizza il livello del profilo', () => {
    expect(kidsLevelOf('CERBIATTO')).toBe('CERBIATTO');
    expect(kidsLevelOf('delfino')).toBe('DELFINO');
    expect(kidsLevelOf('4.1')).toBe('DELFINO'); // ranking FIT finito nel campo level
    expect(kidsLevelOf(null)).toBe('DELFINO');
  });

  it('collega i livelli in progressione', () => {
    expect(kidsNextLevel('DELFINO')).toBe('CERBIATTO');
    expect(kidsNextLevel('CERBIATTO')).toBe('COCCODRILLO');
    expect(kidsNextLevel('COCCODRILLO')).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════

describe('divisione di una pagina nei suoi due passi', () => {
  it('non perde ne duplica obiettivi', () => {
    for (const p of KIDS_PROGRAM_LIST) {
      for (const stage of p.stages) {
        const [a, b] = splitStageIntoSteps(stage);
        const unione = [...a.objectives, ...b.objectives].map((o) => o.key);
        expect(unione).toHaveLength(stage.objectives.length);
        expect(new Set(unione)).toEqual(new Set(stage.objectives.map((o) => o.key)));
      }
    }
  });

  it('non spezza mai un\u2019area a meta\u2019', () => {
    for (const p of KIDS_PROGRAM_LIST) {
      for (const stage of p.stages) {
        const [a, b] = splitStageIntoSteps(stage);
        const aree = [...a.areas, ...b.areas].map((x) => x.area);
        // Ogni area compare una volta sola: sta tutta in un passo o nell'altro.
        expect(new Set(aree).size).toBe(aree.length);
        expect(aree).toEqual(stage.areas.map((x) => x.area));
      }
    }
  });

  it('assegna almeno un obiettivo a ciascuno dei due passi', () => {
    for (const p of KIDS_PROGRAM_LIST) {
      for (const stage of p.stages) {
        const [a, b] = splitStageIntoSteps(stage);
        expect(a.objectives.length).toBeGreaterThan(0);
        expect(b.objectives.length).toBeGreaterThan(0);
      }
    }
  });

  it('e\u2019 deterministica', () => {
    const stage = KIDS_PROGRAMS.DELFINO.stages[0];
    const uno = splitStageIntoSteps(stage);
    const due = splitStageIntoSteps(stage);
    expect(uno[0].objectives.map((o) => o.key)).toEqual(due[0].objectives.map((o) => o.key));
  });
});

// ════════════════════════════════════════════════════════════════════════════

describe('il sentiero dei 12 passi', () => {
  const program = KIDS_PROGRAMS.DELFINO;

  it('produce 12 nodi numerati da 1 a 12', () => {
    for (const p of KIDS_PROGRAM_LIST) {
      const s = computeKidsState(p, new Set());
      expect(s.steps).toHaveLength(12);
      expect(s.steps.map((x) => x.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    }
  });

  it('mette un cancello ogni 2 passi, tranne dopo l\u2019ultimo', () => {
    const s = computeKidsState(program, new Set());
    const conCancello = s.steps.filter((x) => x.gateAfter).map((x) => x.number);
    expect(conCancello).toEqual([2, 4, 6, 8, 10]);
  });

  it('la somma degli obiettivi dei passi copre tutto il percorso', () => {
    for (const p of KIDS_PROGRAM_LIST) {
      const s = computeKidsState(p, new Set());
      const somma = s.steps.reduce((n, x) => n + x.total, 0);
      expect(somma).toBe(s.totalObjectives);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════

describe('sblocco dei passi', () => {
  const program = KIDS_PROGRAMS.DELFINO;

  it('a percorso vuoto sblocca solo i primi due passi', () => {
    const s = computeKidsState(program, new Set());
    expect(s.steps[0].unlocked).toBe(true);
    expect(s.steps[1].unlocked).toBe(true);
    expect(s.steps.slice(2).every((x) => !x.unlocked)).toBe(true);
    expect(s.steps[0].current).toBe(true);
    expect(s.doneObjectives).toBe(0);
    expect(s.finished).toBe(false);
  });

  it('completare un solo passo NON apre il cancello', () => {
    const primo = program.stages[0];
    const [a] = splitStageIntoSteps(primo);
    const s = computeKidsState(program, new Set(a.objectives.map((o) => o.key)));

    expect(s.steps[0].completed).toBe(true);
    expect(s.steps[0].gateAfter).toBe(false); // il cancello sta dopo il passo 2
    expect(s.steps[1].gateOpen).toBe(false);
    expect(s.steps[2].unlocked).toBe(false);
    expect(s.completedSteps).toBe(1);
    // Il passo corrente si sposta sul secondo della coppia.
    expect(s.currentStepIndex).toBe(1);
  });

  it('completare entrambi i passi apre il cancello e sblocca la coppia dopo', () => {
    const s = computeKidsState(program, keysUpToStage('DELFINO', 1));
    expect(s.steps[0].completed).toBe(true);
    expect(s.steps[1].completed).toBe(true);
    expect(s.steps[1].gateOpen).toBe(true);
    expect(s.steps[2].unlocked).toBe(true);
    expect(s.steps[3].unlocked).toBe(true);
    expect(s.steps[4].unlocked).toBe(false);
    expect(s.completedSteps).toBe(2);
    expect(s.currentStepIndex).toBe(2);
  });

  it('ignora le spunte messe fuori ordine su passi bloccati', () => {
    const soloTerzaPagina = new Set(program.stages[2].objectives.map((o) => o.key));
    const s = computeKidsState(program, soloTerzaPagina);
    expect(s.stages[2].completed).toBe(true);
    expect(s.stages[2].unlocked).toBe(false);
    expect(s.steps[6].unlocked).toBe(false);
    expect(s.currentStepIndex).toBe(0);
  });

  it('a percorso completo segnala il traguardo e il livello successivo', () => {
    const s = computeKidsState(program, new Set(kidsAllKeys(program)));
    expect(s.finished).toBe(true);
    expect(s.completedSteps).toBe(12);
    expect(s.completedStages).toBe(6);
    expect(s.percent).toBe(100);
    expect(s.currentStepIndex).toBe(-1);
    expect(s.nextLevel).toBe('CERBIATTO');
    expect(s.tier).toBe(2);
    expect(s.steps.every((x) => x.completed)).toBe(true);
  });

  it("l'ultimo percorso non ha un livello successivo", () => {
    const p = KIDS_PROGRAMS.COCCODRILLO;
    const s = computeKidsState(p, new Set(kidsAllKeys(p)));
    expect(s.finished).toBe(true);
    expect(s.nextLevel).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════

describe("evoluzione dell'avatar", () => {
  it('cambia ogni 4 passi', () => {
    expect([1, 2, 3, 4].map(kidsTierForStep)).toEqual([0, 0, 0, 0]);
    expect([5, 6, 7, 8].map(kidsTierForStep)).toEqual([1, 1, 1, 1]);
    expect([9, 10, 11, 12].map(kidsTierForStep)).toEqual([2, 2, 2, 2]);
  });

  it('coincide con lo stadio calcolato per pagina', () => {
    expect(kidsTierForStage(0)).toBe(0);
    expect(kidsTierForStage(2)).toBe(1);
    expect(kidsTierForStage(5)).toBe(2);
  });

  it("segue il passo corrente dell'allievo", () => {
    const program = KIDS_PROGRAMS.CERBIATTO;
    expect(computeKidsState(program, new Set()).tier).toBe(0);
    expect(computeKidsState(program, keysUpToStage('CERBIATTO', 2)).tier).toBe(1);
    expect(computeKidsState(program, keysUpToStage('CERBIATTO', 4)).tier).toBe(2);
  });

  it('i nodi cambiano avatar in blocco, quattro alla volta', () => {
    const s = computeKidsState(KIDS_PROGRAMS.DELFINO, new Set());
    expect(s.steps.map((x) => x.tier)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════

describe('curve di esperienza e livelli', () => {
  it('un obiettivo vale di piu\u2019 man mano che si avanza', () => {
    const valori = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(xpForObjective);
    expect(valori).toEqual([10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]);
    for (let i = 1; i < valori.length; i++) {
      expect(valori[i]).toBeGreaterThan(valori[i - 1]);
    }
  });

  it('ogni livello costa piu\u2019 del precedente', () => {
    for (let l = 1; l < 30; l++) {
      expect(xpForLevelUp(l + 1)).toBeGreaterThan(xpForLevelUp(l));
    }
  });

  it('si parte dal livello 1 con 0 XP', () => {
    const li = levelForXp(0);
    expect(li.level).toBe(1);
    expect(li.xpIntoLevel).toBe(0);
    expect(li.percent).toBe(0);
  });

  it('xpToReachLevel e levelForXp sono coerenti fra loro', () => {
    for (let l = 1; l <= 40; l++) {
      const soglia = xpToReachLevel(l);
      // Esattamente alla soglia si e\u2019 al livello l...
      expect(levelForXp(soglia).level).toBe(l);
      // ...e un XP prima si e\u2019 ancora al precedente.
      if (l > 1) expect(levelForXp(soglia - 1).level).toBe(l - 1);
    }
  });

  it('la barra dentro il livello non sfora mai', () => {
    for (let xp = 0; xp < 2500; xp += 37) {
      const li = levelForXp(xp);
      expect(li.xpIntoLevel).toBeGreaterThanOrEqual(0);
      expect(li.xpIntoLevel).toBeLessThan(li.xpForNextLevel);
      expect(li.percent).toBeGreaterThanOrEqual(0);
      expect(li.percent).toBeLessThanOrEqual(100);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════

describe('livelli e lucchetti del percorso', () => {
  it('gli XP totali sono la somma di quelli dei passi', () => {
    for (const p of KIDS_PROGRAM_LIST) {
      const s = computeKidsState(p, new Set());
      expect(s.steps.reduce((n, x) => n + x.xpTotal, 0)).toBe(s.xpTotal);
      expect(s.xp).toBe(0);
    }
  });

  it('le soglie dei lucchetti crescono lungo il percorso', () => {
    for (const p of KIDS_PROGRAM_LIST) {
      const s = computeKidsState(p, new Set());
      const soglie = s.stages.map((x) => x.gateLevel);
      for (let i = 1; i < soglie.length; i++) {
        expect(soglie[i]).toBeGreaterThan(soglie[i - 1]);
      }
      // L\u2019ultima soglia coincide con il livello di fine percorso.
      expect(soglie[soglie.length - 1]).toBe(s.maxLevel);
    }
  });

  it('completare una pagina porta ESATTAMENTE al livello del suo lucchetto', () => {
    // E\u2019 l\u2019invariante che tiene insieme le due letture del percorso:
    // "completa la pagina" e "raggiungi il livello N" devono coincidere.
    for (const p of KIDS_PROGRAM_LIST) {
      for (let k = 0; k < p.stages.length; k++) {
        const keys = new Set(
          p.stages.slice(0, k + 1).flatMap((st) => st.objectives.map((o) => o.key))
        );
        const s = computeKidsState(p, keys);
        expect(s.levelInfo.level).toBe(s.stages[k].gateLevel);
      }
    }
  });

  it('il lucchetto si apre solo raggiunto il livello richiesto', () => {
    const p = KIDS_PROGRAMS.DELFINO;
    const primaPagina = new Set(p.stages[0].objectives.map((o) => o.key));
    const s = computeKidsState(p, primaPagina);

    const cancello = s.steps.find((x) => x.gateAfter)!;
    expect(cancello.gateOpen).toBe(true);
    expect(s.levelInfo.level).toBeGreaterThanOrEqual(cancello.gateLevel!);

    // Con la pagina incompleta il livello resta sotto la soglia.
    const parziale = new Set([...primaPagina].slice(0, -1));
    const s2 = computeKidsState(p, parziale);
    const cancello2 = s2.steps.find((x) => x.gateAfter)!;
    expect(cancello2.gateOpen).toBe(false);
    expect(s2.levelInfo.level).toBeLessThan(cancello2.gateLevel!);
  });

  it('le evoluzioni dell\u2019avatar sono a livelli crescenti', () => {
    for (const p of KIDS_PROGRAM_LIST) {
      const s = computeKidsState(p, new Set());
      expect(s.tierLevels[0]).toBe(1);
      expect(s.tierLevels[1]).toBeGreaterThan(s.tierLevels[0]);
      expect(s.tierLevels[2]).toBeGreaterThan(s.tierLevels[1]);
      expect(s.maxLevel).toBeGreaterThan(s.tierLevels[2]);
    }
  });

  it('a percorso concluso si tocca il livello massimo', () => {
    for (const p of KIDS_PROGRAM_LIST) {
      const s = computeKidsState(p, new Set(kidsAllKeys(p)));
      expect(s.xp).toBe(s.xpTotal);
      expect(s.levelInfo.level).toBe(s.maxLevel);
    }
  });
});
