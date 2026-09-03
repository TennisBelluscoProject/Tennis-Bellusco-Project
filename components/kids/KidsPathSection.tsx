'use client';

/**
 * KidsPathSection — contenitore della sezione "Percorsi Kids" nella scheda
 * di un allievo (usato sia dal maestro sia dall'allievo stesso).
 *
 * Responsabilita':
 *   - carica le spunte dell'allievo per il livello scelto
 *   - applica le modifiche in modo ottimistico e le persiste su Supabase
 *   - quando una pagina del libretto si apre, materializza gli obiettivi dei
 *     due passi appena sbloccati come card della sezione Obiettivi
 *   - quando i 12 passi sono tutti compiuti chiama la RPC che registra il
 *     completamento e PROMUOVE l'allievo al livello successivo
 *
 * Il percorso NON parte da solo: e' il maestro a deciderlo, allievo per
 * allievo (`profiles.kids_path_level`, NULL = nessun percorso attivo). Da qui
 * puo' attivarlo, cambiarlo o disattivarlo. Il percorso attivo e' l'unico
 * modificabile; gli altri due restano consultabili in sola lettura.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Trophy } from 'lucide-react';
import { kidsPathRepo, profileRepo } from '@/lib/repositories';
import type { Profile, PlayerLevel } from '@/lib/database.types';
import { KIDS_PROGRAMS, type KidsProgram } from '@/lib/kids/curriculum';
import { computeKidsState, type KidsProgramState } from '@/lib/kids/progress';
import { isEmptyPlan } from '@/lib/kids/goals';
import { Spinner, ConfirmDialog, Dialog, Button } from '@/components/UI';
import { KidsPathMap } from './KidsPathMap';
import { KidsPathPicker } from './KidsPathPicker';
import { KidsStepSheet } from './KidsStepSheet';

interface Props {
  student: Profile;
  /** Chi sta mettendo le spunte (maestro o allievo stesso). */
  actorId: string;
  isCoach: boolean;
  /** Notifica al chiamante che il percorso attivo e' cambiato (null = spento). */
  onLevelChanged?: (newLevel: PlayerLevel | null) => void;
  /**
   * Notifica che delle spunte sono cambiate sulla mappa.
   *
   * Serve perche' ogni obiettivo dei 12 passi ha anche una CARD nel Kanban, e
   * ad allineare le due facce sono i trigger sul database — non questo
   * componente. Il database e' quindi subito giusto, ma la lista di card che
   * il chiamante ha caricato al montaggio non lo sa: senza questa notifica la
   * card resta visibilmente "In programma" fino al ricaricamento della
   * pagina, che e' esattamente il difetto che si vedeva.
   */
  onObjectivesChanged?: (change: KidsObjectivesChange) => void;
}

/** Cosa e' cambiato con una spunta, visto dalla sezione Obiettivi. */
export interface KidsObjectivesChange {
  /** Chiavi degli obiettivi toccati. */
  keys: string[];
  /** true = spuntati (card in "Conclusi"), false = de-spuntati. */
  done: boolean;
  /**
   * true = sono state create o rimosse card, perche' una pagina del libretto
   * si e' aperta o richiusa. In quel caso ritoccare gli stati non basta: la
   * lista va RILETTA dal database.
   */
  listaCambiata: boolean;
}

/**
 * Impronta dei passi sbloccati, es. "111100000000".
 *
 * Serve a capire se una spunta ha APERTO (o richiuso) una pagina del
 * libretto: solo in quel caso le card della sezione Obiettivi vanno
 * rimaterializzate. Confrontare due stringhe evita di risincronizzare a ogni
 * singola spunta, che nella stragrande maggioranza dei casi non cambia nulla.
 */
function improntaSbloccati(state: KidsProgramState): string {
  return state.steps.map((s) => (s.unlocked ? '1' : '0')).join('');
}

export function KidsPathSection({
  student,
  actorId,
  isCoach,
  onLevelChanged,
  onObjectivesChanged,
}: Props) {
  // Percorso attivo: lo decide il maestro, NULL = nessuno. Ne teniamo una
  // copia locale per rispondere subito al clic, senza aspettare che il
  // chiamante ricarichi il profilo.
  const [activeLevel, setActiveLevel] = useState<PlayerLevel | null>(
    student.kids_path_level
  );
  useEffect(() => {
    setActiveLevel(student.kids_path_level);
  }, [student.kids_path_level]);

  const [selectedLevel, setSelectedLevel] = useState<PlayerLevel>(
    student.kids_path_level ?? 'DELFINO'
  );

  /**
   * Quale delle due pagine si sta guardando.
   *
   * Si parte SEMPRE dall'elenco, anche per l'allievo che ha un solo percorso
   * aperto. Costa un tocco in piu', ma e' l'unico punto in cui vede il
   * disegno d'insieme — tre mondi, dove sta adesso, cosa lo aspetta — e
   * quella e' meta' del senso di avere un percorso a livelli.
   */
  const [vista, setVista] = useState<'elenco' | 'percorso'>('elenco');
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set());
  /**
   * Obiettivi che l'allievo ha messo "In corso" nel Kanban.
   *
   * Vivono in `goals.status`, non nelle spunte, quindi vanno letti a parte.
   * Si aggiornano solo dal Kanban: la mappa li puo' solo CHIUDERE, spuntando
   * l'obiettivo.
   */
  const [inProgressKeys, setInProgressKeys] = useState<Set<string>>(new Set());
  const [completedLevels, setCompletedLevels] = useState<Set<PlayerLevel>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [promotedTo, setPromotedTo] = useState<PlayerLevel | null>(null);
  const [disattivaOpen, setDisattivaOpen] = useState(false);

  // Il percorso attivo puo' cambiare (promozione, o scelta del maestro):
  // riallinea la vista su quello.
  //
  // Torna anche all'ELENCO, perche' chi ha appena cambiato percorso deve
  // vedere l'effetto della sua scelta — il bollino che si sposta — invece di
  // ritrovarsi dentro una mappa diversa da quella che stava guardando.
  useEffect(() => {
    if (activeLevel) {
      setSelectedLevel(activeLevel);
      setVista('elenco');
    }
  }, [activeLevel]);

  const program: KidsProgram = KIDS_PROGRAMS[selectedLevel];
  const attivo = activeLevel !== null;
  const editable = attivo && selectedLevel === activeLevel;

  // ─── Caricamento ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [progressRes, completionsRes, inProgressRes] = await Promise.all([
        kidsPathRepo.listProgress(student.id, selectedLevel),
        kidsPathRepo.listCompletions(student.id),
        kidsPathRepo.listInProgress(student.id, selectedLevel),
      ]);
      if (cancelled) return;
      setDoneKeys(new Set(progressRes.data ?? []));
      setCompletedLevels(new Set((completionsRes.data ?? []).map((c) => c.level)));
      setInProgressKeys(new Set(inProgressRes.data ?? []));
      setError(progressRes.error?.message ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [student.id, selectedLevel]);

  const state = useMemo(() => computeKidsState(program, doneKeys), [program, doneKeys]);

  // ─── Spunte (ottimistiche) ────────────────────────────────────────────────

  const applyKeys = useCallback(
    async (keys: string[], done: boolean) => {
      if (!editable || keys.length === 0) return;

      const before = doneKeys;
      const next = new Set(before);
      for (const k of keys) {
        if (done) next.add(k);
        else next.delete(k);
      }
      const primaSbloccati = improntaSbloccati(state);
      const dopoSbloccati = improntaSbloccati(computeKidsState(program, next));

      setDoneKeys(next);
      // Spuntare CHIUDE l'"in corso": la card passa a Conclusi (lo fa il
      // trigger), quindi il pallino sul nodo deve sparire subito insieme al
      // resto, non al prossimo caricamento.
      if (done) {
        setInProgressKeys((prev) => {
          if (!keys.some((k) => prev.has(k))) return prev;
          const rimasti = new Set(prev);
          for (const k of keys) rimasti.delete(k);
          return rimasti;
        });
      }
      setBusy(true);
      setError(null);

      const res = await kidsPathRepo.setObjectives({
        studentId: student.id,
        level: selectedLevel,
        objectiveKeys: keys,
        done,
        actorId,
      });

      if (res.error) {
        setBusy(false);
        setDoneKeys(before); // rollback
        setError(`Salvataggio non riuscito: ${res.error.message}`);
        return;
      }

      // Lo STATO delle card lo allineano i trigger sul database (vedi
      // scripts/sql/2026_kids_goals.sql): qui serve solo materializzare le
      // card dei passi che si sono appena aperti.
      let listaCambiata = false;
      if (primaSbloccati !== dopoSbloccati) {
        const sync = await kidsPathRepo.syncGoals({
          studentId: student.id,
          level: selectedLevel,
          actorId,
        });
        if (sync.error) {
          setError(
            `Obiettivi salvati, ma la sezione Obiettivi non si e' aggiornata: ${sync.error.message}`
          );
        } else {
          listaCambiata = !isEmptyPlan(sync.data);
        }
      }

      // Il database e' allineato, la lista di card del chiamante no: e' stata
      // letta al montaggio. Glielo diciamo, cosi' la card si sposta subito in
      // "Conclusi" invece di aspettare un ricaricamento.
      onObjectivesChanged?.({ keys, done, listaCambiata });

      setBusy(false);
    },
    [
      editable,
      doneKeys,
      student.id,
      selectedLevel,
      actorId,
      program,
      state,
      onObjectivesChanged,
    ]
  );

  const handleToggle = useCallback(
    (key: string, done: boolean) => applyKeys([key], done),
    [applyKeys]
  );

  // ─── Attivazione / cambio / spegnimento (solo maestro) ───────────────────

  /**
   * Un'attivazione alla volta.
   *
   * `busy` disabilita i pulsanti, ma e' uno stato React: fra il clic e il
   * render che lo applica passa un istante, e su un touch screen due tocchi
   * ravvicinati (o un doppio tocco involontario) partono entrambi. Due
   * scritture in volo sullo stesso profilo si sovrappongono e vince quella
   * che arriva per ultima, che non e' detto sia l'ultima richiesta: e' uno
   * dei modi in cui l'attivazione sembrava "non prendere" al primo colpo.
   * Un ref e' sincrono e chiude la porta subito.
   */
  const cambioInCorso = useRef(false);

  const cambiaPercorso = useCallback(
    async (level: PlayerLevel | null) => {
      if (!isCoach) return;
      if (cambioInCorso.current) return;
      cambioInCorso.current = true;
      setBusy(true);
      setError(null);

      const res = await profileRepo.setKidsPath(student.id, level, actorId);
      if (res.error) {
        cambioInCorso.current = false;
        setBusy(false);
        setError(`Operazione non riuscita: ${res.error.message}`);
        return;
      }

      setActiveLevel(level);
      if (level) {
        setSelectedLevel(level);
        // All'attivazione le card dei primi due passi non esistono ancora.
        const sync = await kidsPathRepo.syncGoals({
          studentId: student.id,
          level,
          actorId,
        });
        if (sync.error) {
          setError(
            `Percorso attivato, ma la sezione Obiettivi non si e' aggiornata: ${sync.error.message}`
          );
        }
      } else {
        // Disattivare azzera: il database ha appena cancellato spunte e
        // livelli conclusi, quindi va svuotato anche lo stato locale o la
        // mappa continuerebbe a mostrare i progressi appena eliminati.
        setDoneKeys(new Set());
        setCompletedLevels(new Set());
        setInProgressKeys(new Set());
        setOpenStep(null);
      }

      cambioInCorso.current = false;
      setBusy(false);
      onLevelChanged?.(level);
    },
    [isCoach, student.id, actorId, onLevelChanged]
  );

  // ─── Promozione automatica a percorso concluso ────────────────────────────
  //
  // Scatta una volta sola: `promoting` evita richieste doppie mentre la RPC
  // e' in volo, `completedLevels` evita di richiamarla ai render successivi.
  const promoting = useRef(false);
  useEffect(() => {
    if (loading || busy || !editable) return;
    if (!state.finished) return;
    if (completedLevels.has(selectedLevel)) return;
    if (promoting.current) return;

    promoting.current = true;
    (async () => {
      const res = await kidsPathRepo.completeLevel(student.id, selectedLevel);
      promoting.current = false;
      if (res.error) {
        setError(`Passaggio di livello non riuscito: ${res.error.message}`);
        return;
      }
      setCompletedLevels((prev) => new Set(prev).add(selectedLevel));
      const newLevel = res.data;
      if (newLevel && newLevel !== selectedLevel) {
        setPromotedTo(newLevel);
        onLevelChanged?.(newLevel);
      }
    })();
  }, [
    loading,
    busy,
    editable,
    state.finished,
    completedLevels,
    selectedLevel,
    student.id,
    onLevelChanged,
  ]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const step = openStep !== null ? state.steps[openStep] : null;
  const stepStage = step ? state.stages[step.stageIndex] : null;

  // La scheda del passo viene passata alla mappa: su desktop prende il posto
  // del riepilogo nella colonna destra, sul telefono sale dal basso.
  const schedaPasso =
    step && stepStage ? (
      <KidsStepSheet
        open
        onClose={() => setOpenStep(null)}
        program={program}
        step={step}
        stage={stepStage}
        doneKeys={doneKeys}
        inProgressKeys={inProgressKeys}
        onToggle={handleToggle}
        onToggleAll={applyKeys}
        readOnly={!editable}
        busy={busy}
      />
    ) : null;

  return (
    <div className="flex flex-col">
      {error && <p className="text-[12px] font-semibold text-destructive mb-3">{error}</p>}

      {vista === 'elenco' ? (
        /* PAGINA 1 — la scelta. Tre schede grandi con la loro descrizione,
           chiuse per l'allievo finche' non le raggiunge. */
        <KidsPathPicker
          active={activeLevel}
          completed={completedLevels}
          isCoach={isCoach}
          studentName={student.full_name}
          busy={busy}
          onOpen={(lvl) => {
            setSelectedLevel(lvl);
            setVista('percorso');
          }}
          onActivate={(lvl) => void cambiaPercorso(lvl)}
          onDeactivate={() => setDisattivaOpen(true)}
        />
      ) : (
        /* PAGINA 2 — la mappa, che si prende tutto lo schermo. In cima solo
           il ritorno all'elenco e, se serve, l'avviso di sola lettura: la
           mappa e' alta duemila pixel e non deve dividere l'attenzione. */
        <>
          <div className="flex items-center gap-2.5 mb-3 flex-wrap">
            <button
              type="button"
              onClick={() => setVista('elenco')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 -ml-1 rounded-[var(--radius-md)] text-[12.5px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft size={15} strokeWidth={2.6} />
              Percorsi
            </button>

            <span
              className="text-[13px] font-bold"
              style={{ color: program.colors.ink }}
            >
              {program.name}
            </span>

            {!editable && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.06em]"
                style={{ background: program.colors.soft, color: program.colors.accentDark }}
              >
                {completedLevels.has(selectedLevel) ? 'Concluso' : 'Sola lettura'}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <KidsPathMap
              state={state}
              inProgressKeys={inProgressKeys}
              onOpenStep={setOpenStep}
              detail={schedaPasso}
            />
          )}
        </>
      )}

      {promotedTo && (
        <PromotionDialog
          from={selectedLevel}
          to={promotedTo}
          onClose={() => setPromotedTo(null)}
        />
      )}

      {/* La disattivazione cancella dei dati: va confermata, e il testo deve
          dire esattamente cosa si perde. */}
      <ConfirmDialog
        open={disattivaOpen}
        title="Disattivare e azzerare il percorso?"
        message={`${student.full_name} non vedra' piu' la scheda "12 passi". Verranno cancellati tutte le spunte gia' fatte, i percorsi risultati conclusi e le card dei 12 passi nella sua sezione Obiettivi. Riattivandolo si ripartira' da zero. Gli obiettivi liberi del Kanban non vengono toccati.`}
        confirmLabel="Disattiva e azzera"
        onConfirm={() => {
          setDisattivaOpen(false);
          void cambiaPercorso(null);
        }}
        onCancel={() => setDisattivaOpen(false)}
      />
    </div>
  );
}

// ─── Festeggiamento del passaggio di livello ────────────────────────────────

function PromotionDialog({
  from,
  to,
  onClose,
}: {
  from: PlayerLevel;
  to: PlayerLevel;
  onClose: () => void;
}) {
  const target = KIDS_PROGRAMS[to];
  return (
    <Dialog open onClose={onClose} size="sm" hideClose>
      <div className="text-center pt-2">
        <div
          className="w-16 h-16 rounded-[var(--radius-xl)] mx-auto flex items-center justify-center mb-4 text-white"
          style={{ background: 'linear-gradient(135deg, #F5C33B 0%, #D4A017 100%)' }}
        >
          <Trophy size={30} strokeWidth={2.2} />
        </div>
        <h3 className="text-[20px] font-bold tracking-[-0.025em] mb-2">12 passi compiuti!</h3>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed mb-5">
          Il percorso {KIDS_PROGRAMS[from].name} è concluso.
          <br />
          Da oggi si passa al livello{' '}
          <b style={{ color: target.colors.accent }}>
            {target.emoji} {target.name}
          </b>
          : ti aspettano 12 nuovi passi!
        </p>
        <Button
          block
          size="lg"
          onClick={onClose}
          style={{ backgroundColor: target.colors.accent }}
        >
          Inizia il percorso {target.name}
        </Button>
      </div>
    </Dialog>
  );
}
