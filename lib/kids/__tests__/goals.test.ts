import { describe, it, expect } from 'vitest';
import { KIDS_PROGRAMS } from '../curriculum';
import { computeKidsState } from '../progress';
import {
  kidsGoalDrafts,
  planKidsGoals,
  isEmptyPlan,
  type KidsGoalLink,
} from '../goals';

/**
 * I 12 passi devono comparire nella sezione Obiettivi una pagina per volta:
 * questo file protegge quella regola e i due casi che la rendono delicata,
 * cioe' l'adozione di una card gia' creata a mano dal catalogo e la pulizia
 * quando una pagina si richiude.
 */

const DELFINO = KIDS_PROGRAMS.DELFINO;

/** Chiavi di tutti gli obiettivi delle prime N pagine del libretto. */
function keysUpToStage(n: number): Set<string> {
  return new Set(
    DELFINO.stages.slice(0, n).flatMap((s) => s.objectives.map((o) => o.key))
  );
}

/** Le card che devono esistere date certe spunte. */
function draftsFor(done: Set<string>) {
  return kidsGoalDrafts(computeKidsState(DELFINO, done), done);
}

// ════════════════════════════════════════════════════════════════════════════

describe('quali obiettivi diventano card', () => {
  it('a percorso appena iniziato ci sono solo gli obiettivi dei primi due passi', () => {
    const drafts = draftsFor(new Set());
    const primaPagina = DELFINO.stages[0].objectives.length;

    expect(drafts).toHaveLength(primaPagina);
    expect(drafts.every((d) => d.status === 'planned')).toBe(true);
    // Nessun obiettivo di pagine successive si e' intrufolato.
    const attese = new Set(DELFINO.stages[0].objectives.map((o) => o.key));
    expect(drafts.every((d) => attese.has(d.objectiveKey))).toBe(true);
  });

  it('completata la prima pagina compaiono anche gli obiettivi della seconda', () => {
    const done = keysUpToStage(1);
    const drafts = draftsFor(done);

    const attesi =
      DELFINO.stages[0].objectives.length + DELFINO.stages[1].objectives.length;
    expect(drafts).toHaveLength(attesi);
    // Quelli della prima pagina nascono gia' conclusi.
    const conclusi = drafts.filter((d) => d.status === 'completed');
    expect(conclusi).toHaveLength(DELFINO.stages[0].objectives.length);
  });

  it('non anticipa mai le pagine ancora chiuse', () => {
    const drafts = draftsFor(keysUpToStage(2));
    const chiuse = new Set(
      DELFINO.stages.slice(3).flatMap((s) => s.objectives.map((o) => o.key))
    );
    expect(drafts.some((d) => chiuse.has(d.objectiveKey))).toBe(false);
  });

  it("da a ogni obiettivo la categoria dell'area del libretto", () => {
    const drafts = draftsFor(new Set());
    const categorie = new Set(drafts.map((d) => d.category));
    // Le aree del Diario mappano su quelle dell'app: mente, fisico, tattica...
    for (const c of categorie) {
      expect(['tecnica', 'tattica', 'fisico', 'mente', 'agonismo']).toContain(c);
    }
  });
});

describe('piano di allineamento col Kanban', () => {
  it('la prima volta crea tutte le card della pagina aperta', () => {
    const drafts = draftsFor(new Set());
    const plan = planKidsGoals(DELFINO, drafts, []);

    expect(plan.create).toHaveLength(drafts.length);
    expect(plan.adopt).toHaveLength(0);
    expect(plan.remove).toHaveLength(0);
  });

  it('non fa nulla se le card ci sono gia e sono allineate', () => {
    const drafts = draftsFor(new Set());
    const esistenti: KidsGoalLink[] = drafts.map((d, i) => ({
      id: `goal-${i}`,
      title: d.title,
      status: 'planned',
      kids_objective_key: d.objectiveKey,
      path_node_id: null,
    }));

    expect(isEmptyPlan(planKidsGoals(DELFINO, drafts, esistenti))).toBe(true);
  });

  it('adotta una card creata a mano col testo identico invece di duplicarla', () => {
    const drafts = draftsFor(new Set());
    const primo = drafts[0];
    const esistenti: KidsGoalLink[] = [
      {
        id: 'creata-dal-catalogo',
        // stesso testo, scritto con maiuscole e spazi diversi
        title: `  ${primo.title.toUpperCase()} `,
        status: 'planned',
        kids_objective_key: null,
        path_node_id: null,
      },
    ];

    const plan = planKidsGoals(DELFINO, drafts, esistenti);

    expect(plan.adopt).toHaveLength(1);
    expect(plan.adopt[0].goalId).toBe('creata-dal-catalogo');
    expect(plan.adopt[0].draft.objectiveKey).toBe(primo.objectiveKey);
    // e non la ricrea
    expect(plan.create.some((d) => d.objectiveKey === primo.objectiveKey)).toBe(false);
  });

  it('se la card adottata era gia conclusa, riporta la spunta sulla mappa', () => {
    const drafts = draftsFor(new Set());
    const primo = drafts[0];
    const plan = planKidsGoals(DELFINO, drafts, [
      {
        id: 'gia-fatto',
        title: primo.title,
        status: 'completed',
        kids_objective_key: null,
        path_node_id: null,
      },
    ]);

    expect(plan.adopt[0].tickBack).toBe(true);
  });

  it('non adotta le card di un Percorso libero', () => {
    const drafts = draftsFor(new Set());
    const plan = planKidsGoals(DELFINO, drafts, [
      {
        id: 'nodo-di-percorso',
        title: drafts[0].title,
        status: 'planned',
        kids_objective_key: null,
        path_node_id: 'un-nodo',
      },
    ]);

    expect(plan.adopt).toHaveLength(0);
    expect(plan.create).toHaveLength(drafts.length);
  });

  it('riallinea lo stato di una card andata alla deriva', () => {
    const done = keysUpToStage(1);
    const drafts = draftsFor(done);
    const concluso = drafts.find((d) => d.status === 'completed')!;

    const plan = planKidsGoals(DELFINO, drafts, [
      {
        id: 'da-riallineare',
        title: concluso.title,
        status: 'planned', // sulla mappa e' spuntato, qui no
        kids_objective_key: concluso.objectiveKey,
        path_node_id: null,
      },
    ]);

    expect(plan.restatus).toContainEqual({ goalId: 'da-riallineare', status: 'completed' });
  });

  it('toglie le card di una pagina che si e richiusa, ma tiene le concluse', () => {
    // Le card ci sono per due pagine, poi l'allievo (o il maestro) toglie una
    // spunta e la seconda pagina si richiude.
    const drafts = draftsFor(new Set()); // solo la prima pagina e' aperta
    const secondaPagina = DELFINO.stages[1].objectives;

    const plan = planKidsGoals(DELFINO, drafts, [
      {
        id: 'aperta-da-rimuovere',
        title: secondaPagina[0].title,
        status: 'planned',
        kids_objective_key: secondaPagina[0].key,
        path_node_id: null,
      },
      {
        id: 'conclusa-da-tenere',
        title: secondaPagina[1].title,
        status: 'completed',
        kids_objective_key: secondaPagina[1].key,
        path_node_id: null,
      },
    ]);

    expect(plan.remove).toContain('aperta-da-rimuovere');
    expect(plan.remove).not.toContain('conclusa-da-tenere');
  });

  it('non tocca le card di un altro percorso Kids', () => {
    const drafts = draftsFor(new Set());
    const altroPercorso = KIDS_PROGRAMS.CERBIATTO.stages[0].objectives[0];

    const plan = planKidsGoals(DELFINO, drafts, [
      {
        id: 'roba-di-cerbiatto',
        title: altroPercorso.title,
        status: 'planned',
        kids_objective_key: altroPercorso.key,
        path_node_id: null,
      },
    ]);

    expect(plan.remove).not.toContain('roba-di-cerbiatto');
  });
});
