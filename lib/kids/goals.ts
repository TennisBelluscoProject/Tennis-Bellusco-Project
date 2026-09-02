/**
 * ╭──────────────────────────────────────────────────────────────────────╮
 * │  PERCORSI KIDS — DAI 12 PASSI ALLE CARD DELLA SEZIONE OBIETTIVI       │
 * ╰──────────────────────────────────────────────────────────────────────╯
 *
 * Ogni obiettivo dei 12 passi diventa una CARD del Kanban, come i nodi di un
 * Percorso libero diventano goal tramite `goals.path_node_id`. Qui il legame
 * e' `goals.kids_objective_key` (vedi scripts/sql/2026_kids_goals.sql).
 *
 * REGOLA: compaiono SOLO gli obiettivi dei passi SBLOCCATI.
 * Cioe' quelli delle pagine del libretto gia' aperte: le precedenti (tutte
 * spuntate, quindi card in "Conclusi") e quella corrente, i due passi a cui
 * l'allievo e' arrivato (card in "In programma" o "In corso"). Gli obiettivi
 * dei passi ancora chiusi non esistono come card: comparirebbero come una
 * lista di ottanta cose da fare, che e' esattamente cio' che il percorso a
 * tappe serve a evitare.
 *
 * ADOZIONE INVECE DI DUPLICAZIONE
 * Gran parte di questi obiettivi e' gia' nel catalogo del maestro
 * (`goal_templates`), quindi un allievo puo' avere in Kanban una card creata a
 * mano dal catalogo con lo STESSO testo. In quel caso non ne creiamo una
 * seconda: la card esistente viene ADOTTATA, cioe' le si attacca la chiave
 * dell'obiettivo. Da quel momento e' la stessa cosa vista da due schermate.
 *
 * File PURO: decide COSA fare, non lo fa. L'esecuzione (insert/update/delete)
 * sta nel repository. Cosi' la regola e' testabile senza database.
 */

import type { Goal, GoalCategory, GoalStatus, PlayerLevel } from '@/lib/database.types';
import { KIDS_AREA_CONFIG, KIDS_PROGRAMS, type KidsProgram } from './curriculum';
import type { KidsProgramState } from './progress';

// ─── Cosa deve esistere ─────────────────────────────────────────────────────

/** La card che un obiettivo dei 12 passi deve avere nella sezione Obiettivi. */
export interface KidsGoalDraft {
  /** Chiave stabile dell'obiettivo: e' il legame con la mappa. */
  objectiveKey: string;
  title: string;
  description: string | null;
  category: GoalCategory;
  /** Ordinamento nel Kanban: prima i passi bassi, poi l'ordine del libretto. */
  sortOrder: number;
  /** Stato che la card deve avere, dedotto dalla spunta sulla mappa. */
  status: Extract<GoalStatus, 'planned' | 'completed'>;
}

/** Il minimo che serve sapere di una card esistente per decidere. */
export type KidsGoalLink = Pick<
  Goal,
  'id' | 'title' | 'status' | 'kids_objective_key' | 'path_node_id'
>;

/** Il piano di allineamento fra i 12 passi e il Kanban. */
export interface KidsGoalPlan {
  /** Card da creare da zero. */
  create: KidsGoalDraft[];
  /** Card gia' presenti col testo giusto: basta attaccarci la chiave. */
  adopt: Array<{
    goalId: string;
    draft: KidsGoalDraft;
    /**
     * La card adottata era GIA' in "Conclusi" mentre l'obiettivo sulla mappa
     * non risulta spuntato. In quel caso vince la card: l'allievo quel lavoro
     * l'ha fatto, va riportata la spunta sulla mappa e non il contrario.
     */
    tickBack: boolean;
  }>;
  /** Card da riportare allo stato coerente con la spunta sulla mappa. */
  restatus: Array<{ goalId: string; status: GoalStatus }>;
  /** Card da rimuovere: il passo si e' richiuso, o il testo non esiste piu'. */
  remove: string[];
}

/** Il piano vuoto: niente da fare. */
export const EMPTY_KIDS_GOAL_PLAN: KidsGoalPlan = {
  create: [],
  adopt: [],
  restatus: [],
  remove: [],
};

export function isEmptyPlan(plan: KidsGoalPlan): boolean {
  return (
    plan.create.length === 0 &&
    plan.adopt.length === 0 &&
    plan.restatus.length === 0 &&
    plan.remove.length === 0
  );
}

// ─── Dai passi sbloccati alle card ──────────────────────────────────────────

/**
 * Le card che DEVONO esistere per questo allievo, cioe' gli obiettivi dei
 * passi sbloccati. `doneKeys` sono le spunte gia' presenti sulla mappa: da
 * quelle si deduce se la card nasce in "In programma" o gia' in "Conclusi".
 */
export function kidsGoalDrafts(
  state: KidsProgramState,
  doneKeys: ReadonlySet<string>
): KidsGoalDraft[] {
  const drafts: KidsGoalDraft[] = [];

  for (const step of state.steps) {
    if (!step.unlocked) continue;

    let posizione = 0;
    for (const area of step.areas) {
      for (const objective of area.objectives) {
        drafts.push({
          objectiveKey: objective.key,
          title: objective.title,
          description: objective.hint ?? null,
          // Le aree del libretto hanno una categoria corrispondente fra
          // quelle dell'app (vedi KIDS_AREA_CONFIG): mentali → mente,
          // motori → fisico, e via cosi'.
          category: KIDS_AREA_CONFIG[objective.area].category,
          sortOrder: step.number * 100 + posizione,
          status: doneKeys.has(objective.key) ? 'completed' : 'planned',
        });
        posizione += 1;
      }
    }
  }

  return drafts;
}

// ─── Cosa si vede nel Kanban ────────────────────────────────────────────────
//
// Le card dei 12 passi NON vengono cancellate quando il maestro cambia
// percorso all'allievo (vedi `setKidsPath`: il cambio non azzera niente, e'
// la disattivazione che azzera). Restano quindi in tabella le card del
// percorso precedente, e senza un filtro finirebbero in "In programma"
// insieme a quelle del percorso nuovo: un allievo passato a Cerbiatto si
// ritroverebbe ancora gli obiettivi del Coccodrillo.
//
// La scelta e' filtrare in LETTURA e non cancellare: le card del percorso
// vecchio restano nel database, cosi' se il maestro torna indietro l'allievo
// ritrova il suo lavoro dov'era. Le CONCLUSE restano visibili comunque —
// sono la storia dell'allievo, e toglierle vorrebbe dire far sparire dai
// "Conclusi" tutto cio' che ha fatto nei percorsi precedenti.

/**
 * Il percorso Kids di appartenenza di una card, dedotto dalla chiave
 * (`<slug>.<tappa>.<area>.<titolo>-<hash>`). `null` = card libera, cioe'
 * creata a mano o dal catalogo: non appartiene a nessun percorso.
 */
export function kidsSlugOfGoal(objectiveKey: string | null): string | null {
  if (objectiveKey === null) return null;
  const punto = objectiveKey.indexOf('.');
  return punto === -1 ? null : objectiveKey.slice(0, punto);
}

/**
 * Filtra le card del Kanban tenendo solo quelle sensate per il percorso Kids
 * ATTIVO (`level`, `null` = nessun percorso attivo):
 *
 *   - card libere (custom o dal catalogo)  -> sempre visibili
 *   - card del percorso attivo             -> sempre visibili
 *   - card di un altro percorso            -> solo se gia' concluse
 *
 * Funzione pura: decide cosa mostrare, non tocca il database.
 */
export function visibleKidsGoals<
  T extends Pick<Goal, 'kids_objective_key' | 'status'>,
>(goals: readonly T[], level: PlayerLevel | null): T[] {
  const attivo = level === null ? null : KIDS_PROGRAMS[level].slug;
  return goals.filter((goal) => {
    const slug = kidsSlugOfGoal(goal.kids_objective_key);
    if (slug === null) return true;
    if (slug === attivo) return true;
    return goal.status === 'completed';
  });
}

// ─── Il piano ───────────────────────────────────────────────────────────────

/** Confronto dei titoli tollerante a spazi, maiuscole e tipo di apostrofo. */
function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/\s+/g, ' ');
}

/**
 * Confronta cio' che deve esistere con cio' che c'e' e produce il piano.
 *
 * `existing` sono TUTTE le card dell'allievo (servono anche quelle libere,
 * per l'adozione). `program` serve a capire quali card Kids appartengono a
 * QUESTO percorso: un allievo che ha finito Delfino ha ancora le sue card, e
 * sincronizzare Cerbiatto non deve toccarle.
 */
export function planKidsGoals(
  program: KidsProgram,
  drafts: KidsGoalDraft[],
  existing: readonly KidsGoalLink[]
): KidsGoalPlan {
  const plan: KidsGoalPlan = { create: [], adopt: [], restatus: [], remove: [] };

  const prefisso = `${program.slug}.`;
  const attese = new Map(drafts.map((d) => [d.objectiveKey, d]));

  // Card Kids gia' esistenti, divise fra questo percorso e gli altri.
  const perChiave = new Map<string, KidsGoalLink>();
  for (const goal of existing) {
    const key = goal.kids_objective_key;
    if (key === null || !key.startsWith(prefisso)) continue;
    perChiave.set(key, goal);
  }

  // Candidate all'adozione: card libere (ne' Kids ne' di un Percorso) il cui
  // testo combacia con un obiettivo atteso. Una card puo' essere adottata una
  // volta sola, quindi la si toglie dalla mappa appena usata.
  const adottabili = new Map<string, KidsGoalLink>();
  for (const goal of existing) {
    if (goal.kids_objective_key !== null || goal.path_node_id !== null) continue;
    const chiaveTesto = normalizeTitle(goal.title);
    if (!adottabili.has(chiaveTesto)) adottabili.set(chiaveTesto, goal);
  }

  for (const draft of drafts) {
    const esistente = perChiave.get(draft.objectiveKey);

    if (esistente) {
      // C'e' gia': si controlla solo che lo stato non sia andato alla deriva.
      const conclusa = esistente.status === 'completed';
      const dovrebbeEssereConclusa = draft.status === 'completed';
      if (conclusa !== dovrebbeEssereConclusa) {
        plan.restatus.push({ goalId: esistente.id, status: draft.status });
      }
      continue;
    }

    const daAdottare = adottabili.get(normalizeTitle(draft.title));
    if (daAdottare) {
      adottabili.delete(normalizeTitle(draft.title));
      plan.adopt.push({
        goalId: daAdottare.id,
        draft,
        tickBack: daAdottare.status === 'completed' && draft.status !== 'completed',
      });
      continue;
    }

    plan.create.push(draft);
  }

  // Card Kids di questo percorso che non sono piu' attese: il passo si e'
  // richiuso (spunta tolta a monte) oppure il testo dell'obiettivo e'
  // cambiato e con esso la chiave. Le concluse si tengono: sono storia
  // dell'allievo e cancellarle perderebbe la data di completamento.
  for (const [key, goal] of perChiave) {
    if (attese.has(key)) continue;
    if (goal.status === 'completed') continue;
    plan.remove.push(goal.id);
  }

  return plan;
}
