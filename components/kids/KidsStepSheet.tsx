'use client';

/**
 * KidsStepSheet — la "panoramica" di un passo del percorso.
 *
 * Si apre toccando un nodo del sentiero e risponde a tre domande, sia per il
 * maestro sia per l'allievo:
 *   1. QUANTI obiettivi ha questo passo e quanti ne mancano
 *   2. QUALI sono, divisi per area (mentali / motori / tattici / tecnici)
 *   3. permette di SPUNTARLI direttamente da qui
 *
 * Ricorda anche a quale pagina del libretto appartiene il passo ("Passi 1 e
 * 2") e che il cancello si apre solo completando entrambi i passi della
 * coppia: e' l'informazione che spiega perche' il sentiero resta bloccato.
 *
 * DOVE COMPARE
 *  - da 900px in su e' un PANNELLO nella colonna destra della mappa: prende
 *    il posto del riepilogo, cosi' il sentiero resta visibile mentre si
 *    spuntano gli obiettivi (viene passato a KidsPathMap con la prop
 *    `detail`);
 *  - sotto i 900px e' un FOGLIO che sale dal basso, con la pagina oscurata.
 *
 * Se il passo non e' ancora accessibile il contenuto resta visibile ma in
 * sola lettura: si vede cosa arrivera', non lo si puo' spuntare.
 */

import { useEffect } from 'react';
import { Check, Lock, X } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useIsMobile } from '@/lib/hooks';
import { areasSummary, KIDS_AREA_CONFIG, type KidsProgram } from '@/lib/kids/curriculum';
import type { KidsStageState, KidsStepState } from '@/lib/kids/progress';

/** Sotto questa soglia la scheda diventa un foglio dal basso. */
const SHEET_BELOW = 900;

interface Props {
  open: boolean;
  onClose: () => void;
  program: KidsProgram;
  /** Il passo aperto (1..12). */
  step: KidsStepState;
  /** La coppia di passi a cui appartiene: governa il cancello. */
  stage: KidsStageState;
  /** Chiavi degli obiettivi gia' spuntati. */
  doneKeys: ReadonlySet<string>;
  onToggle: (objectiveKey: string, done: boolean) => void;
  onToggleAll: (objectiveKeys: string[], done: boolean) => void;
  /** Sola lettura (es. anteprima nel catalogo del maestro). */
  readOnly?: boolean;
  /** Operazione in corso: disabilita i comandi. */
  busy?: boolean;
}

export function KidsStepSheet({
  open,
  onClose,
  program,
  step,
  stage,
  doneKeys,
  onToggle,
  onToggleAll,
  readOnly,
  busy,
}: Props) {
  const isSheet = useIsMobile(SHEET_BELOW);

  // Chiusura con ESC sempre; blocco dello scroll di fondo solo quando la
  // scheda copre la pagina (foglio dal basso), non quando e' una colonna.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    if (isSheet) document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, isSheet]);

  if (!open) return null;

  const c = program.colors;
  const locked = !step.unlocked;
  const editable = !readOnly && !locked;
  const allKeys = step.objectives.map((o) => o.key);
  const remaining = step.total - step.done;

  const contenuto = (
    <>
      {/* ─── Testata ─── */}
      <div className="shrink-0 px-4 pt-4 pb-3.5" style={{ background: c.soft }}>
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 w-[46px] h-[46px] rounded-2xl flex flex-col items-center justify-center leading-none"
            style={{
              background: step.completed ? c.accent : '#FFFFFF',
              color: step.completed ? '#FFFFFF' : c.accent,
            }}
          >
            <span className="text-[8px] font-extrabold uppercase tracking-[0.12em] opacity-65">
              passo
            </span>
            <span
              className="text-[21px] font-extrabold tabular-nums"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {step.number}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p
              className="text-[10.5px] font-extrabold uppercase tracking-[0.1em]"
              style={{ color: c.accent }}
            >
              {program.name} · {stage.stage.label}
            </p>
            <h3
              className="text-[17px] font-bold tracking-[-0.015em] leading-tight mt-0.5"
              style={{ color: c.ink, fontFamily: 'var(--font-display)' }}
            >
              Obiettivi {areasSummary(step.areas)}
            </h3>
            <p className="text-[11.5px] text-gray-500 mt-0.5">Campo: {stage.stage.court}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-[10px] flex items-center justify-center bg-white/75 hover:bg-white transition-colors text-gray-500"
            aria-label="Chiudi"
          >
            <X size={16} strokeWidth={2.6} />
          </button>
        </div>

        {/* Avanzamento del passo */}
        <div className="mt-3.5 flex items-center gap-2.5">
          <div className="flex-1 h-2 rounded-full bg-white/70 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${step.percent}%`, background: c.accent }}
            />
          </div>
          <span className="text-[13px] font-bold tabular-nums" style={{ color: c.accent }}>
            {step.done}/{step.total}
          </span>
        </div>

        <p
          className="text-[11.5px] font-semibold tabular-nums mt-2"
          style={{ color: c.accentDark }}
        >
          {step.xpDone} / {step.xpTotal} XP · ogni obiettivo di questo passo vale{' '}
          {step.xpPerObjective} XP
        </p>

        <div
          className="mt-2 rounded-lg px-2.5 py-2 text-[11.5px] leading-relaxed text-gray-600"
          style={{ background: 'rgba(255,255,255,0.72)' }}
        >
          {locked ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-gray-500">
              <Lock size={13} strokeWidth={2.4} />
              Passo bloccato: apri prima il cancello precedente.
            </span>
          ) : step.completed ? (
            <>
              <b style={{ color: c.accent }}>Passo {step.number} compiuto.</b>{' '}
              {stage.completed ? (
                <>Lucchetto aperto: hai raggiunto il livello {stage.gateLevel}.</>
              ) : (
                <>
                  Il lucchetto dopo il passo {stage.stage.steps[1]} si apre al{' '}
                  <b>livello {stage.gateLevel}</b>: manca l&#39;altro passo della pagina (
                  {stage.done}/{stage.total} obiettivi).
                </>
              )}
            </>
          ) : (
            <>
              Ne mancano <b>{remaining}</b> per compiere il passo {step.number}. Il lucchetto dopo
              il passo {stage.stage.steps[1]} si apre al <b>livello {stage.gateLevel}</b>, che si
              raggiunge completando <b>entrambi</b> i passi della pagina ({stage.done}/
              {stage.total} obiettivi).
            </>
          )}
        </div>
      </div>

      {/* ─── Elenco obiettivi ─── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {step.areas.map((area) => {
          const cfg = KIDS_AREA_CONFIG[area.area];
          const fatti = area.objectives.filter((o) => doneKeys.has(o.key)).length;
          return (
            <section key={area.area} className="mb-4 last:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: cfg.bg, color: cfg.color }}
                >
                  <CategoryIcon name={cfg.icon} size={13} strokeWidth={2.4} />
                </span>
                <h4
                  className="text-[13.5px] font-bold tracking-[-0.01em]"
                  style={{ color: cfg.color, fontFamily: 'var(--font-display)' }}
                >
                  {area.label}
                </h4>
                <span className="text-[11px] text-gray-400 font-bold ml-auto tabular-nums">
                  {fatti}/{area.objectives.length}
                </span>
              </div>

              <ul className="flex flex-col gap-1.5">
                {area.objectives.map((o) => {
                  const checked = doneKeys.has(o.key);
                  return (
                    <li key={o.key}>
                      <button
                        type="button"
                        disabled={!editable || busy}
                        onClick={() => onToggle(o.key, !checked)}
                        className={`w-full text-left flex items-start gap-2.5 px-2.5 py-2.5 rounded-xl border transition-all duration-200 ${
                          editable ? 'hover:border-gray-300 active:scale-[0.995]' : 'cursor-default'
                        }`}
                        style={{
                          borderColor: checked ? `${cfg.color}44` : '#EDEFF3',
                          background: checked ? cfg.bg : '#FFFFFF',
                          opacity: locked ? 0.65 : 1,
                        }}
                      >
                        <span
                          className="mt-px w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
                          style={{
                            borderColor: checked ? cfg.color : '#CBD2DD',
                            background: checked ? cfg.color : 'transparent',
                            color: '#FFFFFF',
                          }}
                        >
                          {checked && <Check size={12} strokeWidth={3.6} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-[13px] leading-snug ${
                              checked ? 'font-semibold' : 'font-medium'
                            }`}
                            style={{ color: checked ? cfg.color : '#18223A' }}
                          >
                            {o.title}
                          </span>
                          {o.hint && (
                            <span className="block text-[11px] italic text-gray-500 leading-snug mt-0.5">
                              {o.hint}
                            </span>
                          )}
                        </span>
                        <span
                          className="shrink-0 self-start px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums"
                          style={{
                            background: checked ? cfg.color : '#F1F3F7',
                            color: checked ? '#FFFFFF' : '#9AA3B5',
                          }}
                        >
                          +{step.xpPerObjective}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {/* ─── Azioni ─── */}
      {editable && (
        <div
          className="shrink-0 border-t border-gray-100 px-4 pt-3 pb-3 flex items-center gap-2 bg-white"
          style={{
            // Sul telefono il foglio arriva al bordo inferiore dello schermo.
            // `env(safe-area-inset-bottom)` copre la barra gesti dell'iPhone,
            // ma da solo non basta: sugli schermi con gli angoli arrotondati il
            // tasto resta comunque a filo e la curvatura se lo mangia agli
            // estremi. Il mezzo rem in piu' e' quel respiro.
            paddingBottom: isSheet
              ? 'calc(1.25rem + env(safe-area-inset-bottom, 0px))'
              : undefined,
          }}
        >
          <button
            type="button"
            disabled={busy || step.completed}
            onClick={() => onToggleAll(allKeys, true)}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-40"
            style={{ background: c.accent }}
          >
            Spunta tutto il passo {step.number}
          </button>
          <button
            type="button"
            disabled={busy || step.done === 0}
            onClick={() => onToggleAll(allKeys, false)}
            className="shrink-0 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            Azzera
          </button>
        </div>
      )}
    </>
  );

  // ─── Telefono: foglio che sale dal basso ───
  if (isSheet) {
    return (
      <>
        <div
          className="fixed inset-0 z-[55]"
          style={{
            background: 'rgba(27, 58, 92, 0.3)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
          onClick={onClose}
          aria-hidden
        />
        <div
          className="fixed left-0 right-0 bottom-0 z-[60] flex flex-col overflow-hidden bg-white animate-slide-up"
          style={{
            maxHeight: '86vh',
            borderRadius: '22px 22px 0 0',
            boxShadow: '0 -10px 40px rgba(9, 16, 24, 0.28)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Passo ${step.number}`}
        >
          {contenuto}
        </div>
      </>
    );
  }

  // ─── Desktop: pannello nella colonna destra della mappa ───
  return (
    <div
      className="flex flex-col overflow-hidden bg-white animate-slide-up"
      style={{
        borderRadius: 20,
        border: '1px solid #EDEFF3',
        boxShadow: '0 10px 30px rgba(16, 24, 40, 0.12)',
        maxHeight: 'calc(100vh - 120px)',
      }}
      role="dialog"
      aria-label={`Passo ${step.number}`}
    >
      {contenuto}
    </div>
  );
}
