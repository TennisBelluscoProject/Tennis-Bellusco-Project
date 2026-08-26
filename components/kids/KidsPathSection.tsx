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
import { Trophy, Power, PlayCircle } from 'lucide-react';
import { kidsPathRepo, profileRepo } from '@/lib/repositories';
import type { Profile, PlayerLevel } from '@/lib/database.types';
import {
  KIDS_PROGRAMS,
  KIDS_LEVEL_ORDER,
  type KidsProgram,
} from '@/lib/kids/curriculum';
import { computeKidsState, type KidsProgramState } from '@/lib/kids/progress';
import { Spinner, ConfirmDialog } from '@/components/UI';
import { KidsPathMap } from './KidsPathMap';
import { KidsStepSheet } from './KidsStepSheet';

interface Props {
  student: Profile;
  /** Chi sta mettendo le spunte (maestro o allievo stesso). */
  actorId: string;
  isCoach: boolean;
  /** Notifica al chiamante che il percorso attivo e' cambiato (null = spento). */
  onLevelChanged?: (newLevel: PlayerLevel | null) => void;
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

export function KidsPathSection({ student, actorId, isCoach, onLevelChanged }: Props) {
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
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set());
  const [completedLevels, setCompletedLevels] = useState<Set<PlayerLevel>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [promotedTo, setPromotedTo] = useState<PlayerLevel | null>(null);
  const [disattivaOpen, setDisattivaOpen] = useState(false);

  // Il percorso attivo puo' cambiare (promozione, o scelta del maestro):
  // riallinea la vista su quello.
  useEffect(() => {
    if (activeLevel) setSelectedLevel(activeLevel);
  }, [activeLevel]);

  const program: KidsProgram = KIDS_PROGRAMS[selectedLevel];
  const attivo = activeLevel !== null;
  const editable = attivo && selectedLevel === activeLevel;

  // ─── Caricamento ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [progressRes, completionsRes] = await Promise.all([
        kidsPathRepo.listProgress(student.id, selectedLevel),
        kidsPathRepo.listCompletions(student.id),
      ]);
      if (cancelled) return;
      setDoneKeys(new Set(progressRes.data ?? []));
      setCompletedLevels(new Set((completionsRes.data ?? []).map((c) => c.level)));
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
        }
      }

      setBusy(false);
    },
    [editable, doneKeys, student.id, selectedLevel, actorId, program, state]
  );

  const handleToggle = useCallback(
    (key: string, done: boolean) => applyKeys([key], done),
    [applyKeys]
  );

  // ─── Attivazione / cambio / spegnimento (solo maestro) ───────────────────

  const cambiaPercorso = useCallback(
    async (level: PlayerLevel | null) => {
      if (!isCoach) return;
      setBusy(true);
      setError(null);

      const res = await profileRepo.setKidsPath(student.id, level, actorId);
      if (res.error) {
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
        setOpenStep(null);
      }

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
        onToggle={handleToggle}
        onToggleAll={applyKeys}
        readOnly={!editable}
        busy={busy}
      />
    ) : null;

  return (
    <div className="flex flex-col">
      {/* Selettore dei tre percorsi */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hidden">
        {KIDS_LEVEL_ORDER.map((lvl) => {
          const p = KIDS_PROGRAMS[lvl];
          const isSel = selectedLevel === lvl;
          const isCurrent = lvl === activeLevel;
          const isDone = completedLevels.has(lvl);
          return (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors"
              style={{
                background: isSel ? p.colors.accent : '#FFFFFF',
                borderColor: isSel ? p.colors.accent : '#E2E4E9',
                color: isSel ? '#FFFFFF' : '#6B7280',
              }}
            >
              <span>{p.emoji}</span>
              {p.name}
              {isCurrent && (
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
                  style={{
                    background: isSel ? 'rgba(255,255,255,0.22)' : p.colors.soft,
                    color: isSel ? '#fff' : p.colors.accent,
                  }}
                >
                  attivo
                </span>
              )}
              {isDone && !isCurrent && <span className="text-[11px]">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Comandi del maestro: attiva, cambia, disattiva */}
      {isCoach && (
        <div
          className="rounded-xl px-3.5 py-3 mb-4 flex flex-wrap items-center gap-2.5"
          style={{
            background: attivo ? program.colors.soft : '#F4F5F7',
            border: `1px solid ${attivo ? `${program.colors.accent}33` : '#E2E4E9'}`,
          }}
        >
          <p
            className="flex-1 min-w-[200px] text-[12.5px] leading-relaxed"
            style={{ color: attivo ? program.colors.accentDark : '#4B5563' }}
          >
            {!attivo ? (
              <>
                <b>Nessun percorso attivo</b> per {student.full_name}. Scegli qui
                sopra quale dei tre assegnargli e attivalo: l&#39;allievo vedra&#39; la
                mappa e i primi due passi finiranno nei suoi obiettivi.
              </>
            ) : selectedLevel !== activeLevel ? (
              <>
                Stai guardando <b>{program.name}</b> in sola lettura. Il percorso
                attivo e&#39; <b>{KIDS_PROGRAMS[activeLevel].name}</b>.
              </>
            ) : (
              <>
                Percorso <b>{program.name}</b> attivo per {student.full_name}.
              </>
            )}
          </p>

          {selectedLevel !== activeLevel ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => cambiaPercorso(selectedLevel)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: program.colors.accent }}
            >
              <PlayCircle size={15} strokeWidth={2.4} />
              {attivo ? `Passa a ${program.name}` : `Attiva ${program.name}`}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setDisattivaOpen(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Power size={15} strokeWidth={2.4} />
              Disattiva e azzera
            </button>
          )}
        </div>
      )}

      {attivo && !editable && (
        <div
          className="rounded-xl px-3.5 py-2.5 mb-4 text-[12px] leading-relaxed"
          style={{ background: program.colors.soft, color: program.colors.accentDark }}
        >
          {completedLevels.has(selectedLevel)
            ? `Percorso ${program.name} gia' concluso: lo stai consultando in sola lettura.`
            : `Anteprima del percorso ${program.name}: non e' quello attivo, quindi non e' modificabile.`}
        </div>
      )}

      {!attivo && !isCoach && (
        <div className="rounded-xl px-3.5 py-2.5 mb-4 text-[12px] leading-relaxed bg-gray-50 text-gray-500">
          Il tuo maestro non ti ha ancora assegnato un percorso a 12 passi.
          Quello qui sotto e&#39; solo un&#39;anteprima.
        </div>
      )}

      {error && (
        <p className="text-[12px] font-medium text-red-600 mb-3">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <KidsPathMap
          state={state}
          onOpenStep={setOpenStep}
          detail={schedaPasso}
        />
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
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog-content p-7 text-center animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center mb-4 text-white"
          style={{ background: 'linear-gradient(135deg, #F5C33B 0%, #D4A017 100%)' }}
        >
          <Trophy size={30} strokeWidth={2.2} />
        </div>
        <h3
          className="text-xl font-bold text-gray-900 mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          12 passi compiuti!
        </h3>
        <p className="text-[13.5px] text-gray-600 leading-relaxed mb-5">
          Il percorso {KIDS_PROGRAMS[from].name} è concluso.
          <br />
          Da oggi si passa al livello{' '}
          <b style={{ color: target.colors.accent }}>
            {target.emoji} {target.name}
          </b>
          : ti aspettano 12 nuovi passi!
        </p>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold"
          style={{ background: target.colors.accent }}
        >
          Inizia il percorso {target.name}
        </button>
      </div>
    </div>
  );
}
