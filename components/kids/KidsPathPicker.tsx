'use client';

/**
 * ╭──────────────────────────────────────────────────────────────────────╮
 * │  SCELTA DEL PERCORSO — la pagina che si vede prima della mappa       │
 * ╰──────────────────────────────────────────────────────────────────────╯
 *
 * Tre schede grandi, una per mondo, ognuna con la sua descrizione. Non e' un
 * selettore: e' una PAGINA A SE'. Si sceglie un percorso e la mappa dei 12
 * passi prende tutto lo schermo, con un "torna ai percorsi" in cima.
 *
 * Il motivo di tenerle separate: la mappa e' alta duemila pixel e vuole tutta
 * l'attenzione. Avere sopra un selettore sempre presente significava sprecare
 * mezzo schermo di telefono in comandi ogni volta che si guardava il percorso,
 * e la scelta del mondo non e' una cosa che si fa spesso — il maestro la fa
 * una volta ogni qualche mese, l'allievo mai.
 *
 * IL PUNTO: LE DUE PERSONE VEDONO COSE DIVERSE
 *
 *   ALLIEVO — apre solo il percorso assegnato e quelli gia' conclusi. Gli
 *   altri hanno il lucchetto, la grafica in grigio e non si aprono. Non e' una
 *   protezione tecnica (a quella pensa RLS sul database): e' che poter entrare
 *   in un percorso che non e' il tuo toglie senso all'unico che lo e'.
 *
 *   MAESTRO — li apre tutti, perche' deve confrontarli prima di assegnarne
 *   uno. Ma deve capire a colpo d'occhio QUALE e' quello attivo per QUESTO
 *   allievo: da qui il bollino, e il fatto che i non assegnati restino
 *   visibilmente spenti anche per lui.
 *
 * Componente PRESENTAZIONALE: riceve lo stato, notifica le intenzioni.
 */

import Image from 'next/image';
import { ArrowRight, Check, Lock, PlayCircle, Power } from 'lucide-react';
import type { PlayerLevel } from '@/lib/database.types';
import { KIDS_LEVEL_ORDER, KIDS_PROGRAMS } from '@/lib/kids/curriculum';
import { WORLDS } from '@/lib/paths/worlds';

/** In che rapporto sta l'allievo con un percorso. */
type Stato =
  /** E' quello che il maestro gli ha assegnato adesso. */
  | 'attivo'
  /** L'ha gia' portato a termine: resta consultabile. */
  | 'concluso'
  /** Aperto ma non assegnato. */
  | 'disponibile'
  /** Chiuso: serve concludere quello prima. */
  | 'bloccato';

/**
 * Cosa si impara in ogni percorso, in una riga.
 *
 * Sta qui e non in `curriculum.ts` perche' e' TESTO DI INTERFACCIA, non
 * materiale didattico: il campo `intro` del programma e' la frase del
 * libretto FIT, lunga tre righe e scritta per l'allievo che ha gia' aperto la
 * pagina. Qui serve invece una riga che aiuti a SCEGLIERE.
 */
const DESCRIZIONI: Record<string, string> = {
  DELFINO:
    'I primi passi: prendere confidenza con racchetta, palla e campo, imparare a mandarla di la\u0027 dalla rete e a giocare i primi scambi.',
  CERBIATTO:
    'Si alza il livello: colpire in movimento, le prime rotazioni, la risposta al servizio e le scelte tattiche vere.',
  COCCODRILLO:
    'Il passo verso l\u0027agonismo: ritmo, anticipo e costruzione del punto, fino al campo regolamentare.',
};

interface Props {
  active: PlayerLevel | null;
  completed: ReadonlySet<PlayerLevel>;
  isCoach: boolean;
  studentName: string;
  busy: boolean;
  /** Apre la mappa di quel percorso: e' il cambio di vista. */
  onOpen: (level: PlayerLevel) => void;
  /** Solo maestro: assegna questo percorso all'allievo. */
  onActivate: (level: PlayerLevel) => void;
  /** Solo maestro: toglie il percorso e azzera i progressi. */
  onDeactivate: () => void;
}

/**
 * Lo stato di un percorso.
 *
 * Nota il caso "nessun percorso attivo": il primo mondo resta comunque
 * apribile, altrimenti un allievo appena iscritto troverebbe tre lucchetti e
 * nient'altro, senza nemmeno capire cosa lo aspetta.
 */
function statoDi(
  level: PlayerLevel,
  active: PlayerLevel | null,
  completed: ReadonlySet<PlayerLevel>
): Stato {
  if (level === active) return 'attivo';
  if (completed.has(level)) return 'concluso';
  if (active === null && level === KIDS_LEVEL_ORDER[0]) return 'disponibile';
  return 'bloccato';
}

export function KidsPathPicker({
  active,
  completed,
  isCoach,
  studentName,
  busy,
  onOpen,
  onActivate,
  onDeactivate,
}: Props) {
  const nome = studentName.split(' ')[0] || studentName;

  return (
    // Respiro in fondo: nella pagina dell'elenco l'ultima scheda (COCCODRILLO)
    // e' l'ultima cosa della pagina, e senza questo tocca il bordo dello
    // schermo. Sta qui e non sul contenitore in PlayerView perche' quello
    // ospita anche la mappa, che il respiro se lo porta gia' dentro (la fascia
    // del traguardo) e sotto la quale un rientro in piu' sembrerebbe un
    // ritaglio sbagliato del fondale.
    <div
      className="flex flex-col gap-3.5"
      style={{ paddingBottom: 'calc(1.5rem + var(--safe-bottom))' }}
    >
      {KIDS_LEVEL_ORDER.map((level, i) => {
        const program = KIDS_PROGRAMS[level];
        const world = WORLDS[level];
        const stato = statoDi(level, active, completed);
        const c = program.colors;

        // Il maestro apre tutto: deve poter confrontare i tre prima di
        // assegnarne uno. L'allievo no.
        const apribile = isCoach || stato !== 'bloccato';
        const chiuso = stato === 'bloccato';
        const precedente = i > 0 ? KIDS_PROGRAMS[KIDS_LEVEL_ORDER[i - 1]].name : null;
        const passi = program.stages.length * 2;

        return (
          <article
            key={level}
            className="rounded-[var(--radius-xl)] overflow-hidden bg-card"
            style={{
              border: `1.5px solid ${stato === 'attivo' ? c.accent : 'var(--border)'}`,
              boxShadow: stato === 'attivo' ? `0 6px 20px ${c.accent}26` : 'var(--shadow-xs)',
            }}
          >
            <button
              type="button"
              disabled={!apribile}
              onClick={() => onOpen(level)}
              className="w-full text-left disabled:cursor-not-allowed"
            >
              {/* Fascia illustrata: il gradiente e' quello VERO del mondo,
                  campionato da worlds.ts. Cosi' la scheda anticipa il colore
                  della mappa che si aprira', e non e' una decorazione a caso. */}
              <div
                className="relative overflow-hidden"
                style={{
                  height: 116,
                  background: `linear-gradient(118deg, ${world.gradient[1]}, ${world.gradient[4]})`,
                  filter: chiuso ? 'grayscale(0.85)' : undefined,
                }}
              >
                <Image
                  src={`/percorsi/${program.slug}/cucciolo.png`}
                  alt=""
                  width={112}
                  height={112}
                  sizes="112px"
                  className="absolute object-contain"
                  style={{
                    right: 12,
                    bottom: -4,
                    width: 104,
                    height: 104,
                    opacity: chiuso ? 0.5 : 1,
                  }}
                />

                <div className="absolute left-4 top-3.5 right-[120px]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-white/75">
                      Percorso {i + 1}
                    </span>
                    {stato === 'attivo' && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-[0.08em] text-white"
                        style={{ background: c.accent }}
                      >
                        Attivo
                      </span>
                    )}
                    {stato === 'concluso' && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-[0.08em] text-white bg-white/25">
                        <Check size={9} strokeWidth={3.4} />
                        Concluso
                      </span>
                    )}
                  </span>
                  <h3
                    className="text-[22px] font-extrabold leading-tight text-white mt-1"
                    style={{ fontFamily: 'var(--font-display)', textShadow: '0 2px 8px rgba(9,16,24,0.3)' }}
                  >
                    {program.name}
                  </h3>
                  <p className="text-[11px] text-white/80 leading-snug mt-0.5">{world.tagline}</p>
                </div>

                {chiuso && (
                  <span
                    className="absolute rounded-full flex items-center justify-center"
                    style={{
                      right: 14,
                      top: 14,
                      width: 30,
                      height: 30,
                      background: 'rgba(16,24,32,0.55)',
                      backdropFilter: 'blur(2px)',
                    }}
                  >
                    <Lock size={14} strokeWidth={2.6} color="#FFFFFF" />
                  </span>
                )}
              </div>

              <div className="px-4 pt-3 pb-3.5">
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                  {DESCRIZIONI[level]}
                </p>

                <div className="flex items-center justify-between gap-3 mt-3">
                  <span className="text-[11px] font-semibold text-subtle-foreground">
                    {passi} passi &middot; {program.stages.length} tappe
                  </span>

                  {apribile ? (
                    <span
                      className="inline-flex items-center gap-1 text-[12.5px] font-bold shrink-0"
                      style={{ color: c.accent }}
                    >
                      {stato === 'attivo' ? 'Continua' : 'Guarda'}
                      <ArrowRight size={14} strokeWidth={2.8} />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-subtle-foreground leading-snug shrink-0 text-right">
                      <Lock size={12} strokeWidth={2.6} className="shrink-0" />
                      {precedente ? `Si apre concludendo ${precedente}` : 'Non ancora disponibile'}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Comandi del maestro: dentro la scheda del percorso su cui
                agiscono, non in una barra separata sopra la mappa. */}
            {isCoach && (
              <div
                className="px-4 py-3 flex items-center gap-2 flex-wrap border-t border-border-soft bg-muted"
              >
                {stato === 'attivo' ? (
                  <>
                    <span className="flex-1 min-w-[130px] text-[11.5px] text-muted-foreground leading-snug">
                      In corso per <b className="text-foreground">{nome}</b>
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onDeactivate}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-[12px] font-semibold text-foreground bg-card border border-border hover:border-[var(--border-strong)] transition-colors disabled:opacity-50"
                    >
                      <Power size={13} strokeWidth={2.4} />
                      Disattiva
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 min-w-[130px] text-[11.5px] text-subtle-foreground leading-snug">
                      {stato === 'concluso' ? 'Gia\u0027 concluso' : 'Non assegnato'}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onActivate(level)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-opacity disabled:opacity-50"
                      style={{ background: c.accent }}
                    >
                      <PlayCircle size={14} strokeWidth={2.4} />
                      {active ? 'Assegna questo' : 'Attiva'}
                    </button>
                  </>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
