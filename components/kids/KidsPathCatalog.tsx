'use client';

/**
 * KidsPathCatalog — la sezione "Percorsi Kids" del catalogo maestro.
 *
 * Mostra i TRE percorsi dei 12 passi (Delfino, Cerbiatto, Coccodrillo),
 * ognuno con il colore del proprio mondo. Aprendone uno si puo':
 *   - sfogliare il contenuto delle 6 tappe (anteprima in sola lettura)
 *   - ATTIVARE il percorso a un allievo, e vedere a che punto e' chi lo segue
 *
 * La scheda "Allievi" non e' piu' una scorciatoia verso il profilo: e' il
 * banco di regia del percorso, come il pannello "Attiva" dei percorsi
 * classici. Le spunte si continuano a mettere dalla scheda del singolo
 * allievo; qui si decide CHI lo segue.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, ChevronLeft, PlayCircle, Power } from 'lucide-react';
import type { PlayerLevel, Profile } from '@/lib/database.types';
import { kidsPathRepo, profileRepo } from '@/lib/repositories';
import {
  KIDS_PROGRAM_LIST,
  KIDS_PROGRAMS,
  kidsTotalObjectives,
  type KidsProgram,
} from '@/lib/kids/curriculum';
import { WORLDS } from '@/lib/paths/worlds';
import { computeKidsState } from '@/lib/kids/progress';
import { Spinner, EmptyState, SearchBar, Button, ConfirmDialog } from '@/components/UI';
import { useIsMobile } from '@/lib/hooks';
import { KidsPathMap, FULL_BLEED_AT } from './KidsPathMap';
import { KidsStepSheet } from './KidsStepSheet';

interface Props {
  /** Chi sta attivando i percorsi: finisce in `kids_path_set_by`. */
  coachId: string;
}

export function KidsPathCatalog({ coachId }: Props) {
  const [openLevel, setOpenLevel] = useState<PlayerLevel | null>(null);

  if (openLevel) {
    return (
      <KidsProgramDetail
        program={KIDS_PROGRAMS[openLevel]}
        coachId={coachId}
        onBack={() => setOpenLevel(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <p className="shrink-0 text-[12px] text-muted-foreground mb-3">
        I tre percorsi da 12 passi del Diario del Tennis. Apri un percorso per
        sfogliarlo e per attivarlo ai tuoi allievi.
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto px-1 pt-2 pb-4 -mx-1">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
          {KIDS_PROGRAM_LIST.map((p, i) => (
            <ProgramCard
              key={p.level}
              program={p}
              index={i}
              onOpen={() => setOpenLevel(p.level)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Card di un percorso ────────────────────────────────────────────────────
//
// Stessa grammatica della scheda che l'allievo vede nel suo "12 passi"
// (KidsPathPicker): fascia illustrata col gradiente VERO del mondo, mascotte
// a destra, corpo sobrio sul foglio della card. Cosi' il catalogo e la scheda
// dell'allievo sembrano lo stesso prodotto e non due schermate imparentate
// alla lontana — ed e' anche il motivo per cui qui non c'e' piu' la fascia
// piatta di colore pieno: era l'unico punto dell'app che la usava.

function ProgramCard({
  program,
  index,
  onOpen,
}: {
  program: KidsProgram;
  index: number;
  onOpen: () => void;
}) {
  const c = program.colors;
  const world = WORLDS[program.level];
  const total = kidsTotalObjectives(program);
  const passi = program.stages.length * 2;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left rounded-[var(--radius-2xl)] overflow-hidden bg-card flex flex-col
                 transition-all duration-300 ease-out hover:-translate-y-1 animate-fade-in
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      style={{
        border: '1.5px solid var(--border-soft)',
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.borderColor = `${c.accent}66`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.borderColor = 'var(--border-soft)';
      }}
    >
      {/* Fascia illustrata: il gradiente e' quello VERO del mondo, campionato
          da worlds.ts, cosi' la card anticipa il colore della mappa. */}
      <div
        className="relative overflow-hidden shrink-0"
        style={{
          height: 128,
          background: `linear-gradient(118deg, ${world.gradient[1]}, ${world.gradient[4]})`,
        }}
      >
        {/* La stessa luce che sta in cima alla mappa. */}
        <span
          aria-hidden
          className="absolute pointer-events-none rounded-full"
          style={{
            right: -46,
            top: -58,
            width: 190,
            height: 190,
            background: `radial-gradient(circle, ${world.sunStart}88 0%, ${world.sunStart}1F 48%, transparent 72%)`,
          }}
        />
        {/* Velo scuro in basso: tiene leggibile il testo su qualunque mondo. */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: 66,
            background: 'linear-gradient(to top, rgba(9,16,24,0.34), transparent)',
          }}
        />
        {/* Velo a sinistra, gemello di quello in basso. Il gradiente del
            mondo parte dal suo colore piu' CHIARO, e proprio sopra quella
            meta' ci va il nome del percorso in bianco: su Delfino finiva su
            azzurro pallido. Scurisce solo il lato del testo e lascia il
            colore del mondo intatto dove si vede la mascotte. */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 pointer-events-none"
          style={{
            width: '68%',
            background: 'linear-gradient(to right, rgba(9,16,24,0.42), transparent)',
          }}
        />

        <Image
          src={`/percorsi/${program.slug}/cucciolo.png`}
          alt=""
          width={116}
          height={116}
          sizes="116px"
          className="absolute object-contain transition-transform duration-300 ease-out group-hover:scale-105"
          style={{
            right: 8,
            bottom: -6,
            width: 108,
            height: 108,
            filter: 'drop-shadow(0 6px 14px rgba(9,16,24,0.35))',
          }}
        />

        <div className="absolute left-4 top-3.5 right-[112px]">
          <span className="text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-white/70">
            Percorso {index + 1}
          </span>
          <h3
            className="text-[21px] font-extrabold leading-tight text-white mt-0.5"
            style={{
              fontFamily: 'var(--font-display)',
              textShadow: '0 2px 10px rgba(9,16,24,0.35)',
            }}
          >
            {program.name}
          </h3>
          <p className="text-[10.5px] text-white/80 leading-snug mt-0.5 truncate">
            {world.tagline}
          </p>
        </div>
      </div>

      {/* Corpo */}
      <div className="flex-1 flex flex-col px-4 pt-3.5 pb-3.5">
        <p className="text-[12.5px] text-muted-foreground leading-relaxed">
          {program.intro}
        </p>

        <div className="flex items-center gap-3.5 mt-3.5">
          <Stat value={passi} label="passi" color={c.accent} />
          <StatDivider />
          <Stat value={program.stages.length} label="tappe" color={c.accent} />
          <StatDivider />
          <Stat value={total} label="obiettivi" color={c.accent} />
        </div>

        <div className="flex items-center justify-between gap-3 mt-auto pt-3.5">
          <span className="text-[11px] font-semibold text-subtle-foreground">
            Sfoglia e assegna
          </span>
          <span
            className="inline-flex items-center gap-1 text-[12.5px] font-bold shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
            style={{ color: c.accent }}
          >
            Apri
            <ArrowRight size={14} strokeWidth={2.8} />
          </span>
        </div>
      </div>
    </button>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <span className="flex flex-col leading-none">
      <b
        className="text-[15px] font-extrabold tabular-nums tracking-[-0.02em]"
        style={{ color, fontFamily: 'var(--font-display)' }}
      >
        {value}
      </b>
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground mt-1">
        {label}
      </span>
    </span>
  );
}

function StatDivider() {
  return <span aria-hidden className="w-px h-6 bg-[var(--border-soft)]" />;
}

// ─── Dettaglio di un percorso ───────────────────────────────────────────────

function KidsProgramDetail({
  program,
  coachId,
  onBack,
}: {
  program: KidsProgram;
  coachId: string;
  onBack: () => void;
}) {
  const [view, setView] = useState<'passi' | 'allievi'>('passi');
  const [openStep, setOpenStep] = useState<number | null>(null);

  // Sul telefono l'anteprima della mappa esce dai margini come nella scheda
  // dell'allievo. Il contenitore di scorrimento deve quindi arrivare ai bordi
  // e rimettere il respiro come PADDING: `overflow-y: auto` fa calcolare anche
  // `overflow-x` ad `auto`, e un contenitore di scorrimento ritaglia tutto
  // quello che sporge dal suo padding box. Solo sul telefono: piu' in su la
  // mappa non e' full-bleed e queste classi non servirebbero a niente.
  const isPhone = useIsMobile(FULL_BLEED_AT);

  // Anteprima: nessun obiettivo spuntato, quindi solo i primi due passi
  // risultano sbloccati. Il maestro puo' comunque aprire e leggere tutto.
  const preview = useMemo(() => computeKidsState(program, new Set<string>()), [program]);
  const step = openStep !== null ? preview.steps[openStep] : null;
  const stepStage = step ? preview.stages[step.stageIndex] : null;

  // Anteprima: ogni passo e' consultabile, quindi forziamo `unlocked`.
  // La scheda va alla mappa, che la mette nella colonna destra (desktop)
  // o la fa salire dal basso (telefono).
  const schedaPasso =
    step && stepStage ? (
      <KidsStepSheet
        open
        onClose={() => setOpenStep(null)}
        program={program}
        step={{ ...step, unlocked: true }}
        stage={{ ...stepStage, unlocked: true }}
        doneKeys={new Set<string>()}
        onToggle={() => {}}
        onToggleAll={() => {}}
        readOnly
      />
    ) : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center gap-2 mb-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} />
          Percorsi Kids
        </button>
        <span className="text-[var(--border-strong)]">/</span>
        <span className="text-[13px] font-bold" style={{ color: program.colors.accent }}>
          {program.emoji} {program.name}
        </span>
      </div>

      <div className="shrink-0 flex gap-2 mb-4">
        {(['passi', 'allievi'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="px-3.5 py-1.5 rounded-[var(--radius-md)] text-[13px] font-semibold border transition-colors"
            style={{
              background: view === v ? program.colors.accent : 'var(--card)',
              borderColor: view === v ? program.colors.accent : 'var(--border)',
              color: view === v ? '#fff' : 'var(--muted-foreground)',
            }}
          >
            {v === 'passi' ? 'I 12 passi' : 'Allievi'}
          </button>
        ))}
      </div>

      <div
        className={`flex-1 min-h-0 overflow-y-auto pb-6 ${
          isPhone ? 'full-bleed page-gutter-x' : ''
        }`}
      >
        {view === 'passi' ? (
          <>
            <KidsPathMap state={preview} onOpenStep={setOpenStep} detail={schedaPasso} />
          </>
        ) : (
          <StudentActivationList program={program} coachId={coachId} />
        )}
      </div>
    </div>
  );
}

// ─── Allievi: attivazione + avanzamento ─────────────────────────────────────
//
// Prima questa lista apriva la scheda dell'allievo. Aprire un profilo intero
// per fare l'unica cosa che serve da qui — dire "questo percorso e' suo" — era
// un giro lungo, e dal profilo non si tornava al catalogo. Ora funziona come
// il pannello "Attiva" dei percorsi classici: una riga per allievo, un
// pulsante, e la barra di avanzamento di chi lo sta gia' facendo.
//
// L'elenco NON e' piu' filtrato per livello di classifica: il percorso lo
// decide il maestro allievo per allievo (`profiles.kids_path_level`), quindi
// filtrare per ranking avrebbe nascosto proprio le persone a cui si vuole
// assegnare qualcosa di diverso dal loro livello.

function StudentActivationList({
  program,
  coachId,
}: {
  program: KidsProgram;
  coachId: string;
}) {
  const [students, setStudents] = useState<Profile[]>([]);
  /** Percorso attivo di ogni allievo: copia locale, cambia al clic. */
  const [levels, setLevels] = useState<Map<string, PlayerLevel | null>>(new Map());
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Conferma in sospeso: cambio di percorso oppure spegnimento. */
  const [conferma, setConferma] = useState<Conferma | null>(null);

  const total = kidsTotalObjectives(program);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [stud, cnt] = await Promise.all([
        profileRepo.listApprovedStudents(),
        kidsPathRepo.countsByLevel(program.level),
      ]);
      if (cancelled) return;
      const list = stud.data ?? [];
      setStudents(list);
      setLevels(new Map(list.map((s) => [s.id, s.kids_path_level])));
      setCounts(new Map((cnt.data ?? []).map((r) => [r.studentId, r.done])));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [program.level]);

  /**
   * Un'operazione alla volta, con un ref e non con `busyId`: fra il clic e il
   * render che disabilita i pulsanti passa un istante, e su un touch screen
   * due tocchi ravvicinati partono entrambi. Due scritture in volo sullo
   * stesso profilo si sovrappongono e vince quella che arriva per ultima, che
   * non e' detto sia l'ultima richiesta.
   */
  const inVolo = useRef(false);

  const cambia = useCallback(
    async (student: Profile, level: PlayerLevel | null) => {
      if (inVolo.current) return;
      inVolo.current = true;
      setBusyId(student.id);
      setError(null);

      const res = await profileRepo.setKidsPath(student.id, level, coachId);
      if (res.error) {
        inVolo.current = false;
        setBusyId(null);
        setError(
          `${level ? 'Attivazione' : 'Disattivazione'} non riuscita: ${res.error.message}`
        );
        return;
      }

      setLevels((prev) => new Map(prev).set(student.id, level));

      if (level) {
        // All'attivazione le card dei primi due passi non esistono ancora.
        const sync = await kidsPathRepo.syncGoals({
          studentId: student.id,
          level,
          actorId: coachId,
        });
        if (sync.error) {
          setError(
            `Percorso attivato, ma la sezione Obiettivi non si e' aggiornata: ${sync.error.message}`
          );
        }
      } else {
        // Disattivare AZZERA: la RPC ha appena cancellato spunte e livelli
        // conclusi, quindi la barra di questo allievo deve tornare a zero
        // subito, non al prossimo caricamento.
        setCounts((prev) => {
          const next = new Map(prev);
          next.delete(student.id);
          return next;
        });
      }

      inVolo.current = false;
      setBusyId(null);
    },
    [coachId]
  );

  /**
   * Clic su "Attiva": diretto se l'allievo e' libero, con conferma se sta
   * gia' seguendo un ALTRO percorso Kids. Ne puo' avere uno solo, quindi
   * attivare qui significa spegnere quello.
   */
  const chiediAttivazione = (student: Profile) => {
    const corrente = levels.get(student.id) ?? null;
    if (corrente && corrente !== program.level) {
      setConferma({ kind: 'switch', student, from: corrente });
      return;
    }
    void cambia(student, program.level);
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter((s) => (q ? s.full_name.toLowerCase().includes(q) : true))
      .map((s) => {
        const corrente = levels.get(s.id) ?? null;
        const attivo = corrente === program.level;
        const done = counts.get(s.id) ?? 0;
        return {
          student: s,
          attivo,
          altro: attivo ? null : corrente,
          done,
          percent: total > 0 ? Math.round((done / total) * 100) : 0,
        };
      })
      // Prima chi segue QUESTO percorso, poi chi ha piu' strada fatta.
      .sort(
        (a, b) =>
          Number(b.attivo) - Number(a.attivo) ||
          b.done - a.done ||
          a.student.full_name.localeCompare(b.student.full_name)
      );
  }, [students, levels, counts, search, program.level, total]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchBar value={search} onChange={setSearch} placeholder="Cerca allievo..." />

      {error && <p className="text-[12px] font-semibold text-destructive">{error}</p>}

      {rows.length === 0 ? (
        <EmptyState
          icon={<span className="text-4xl">{program.emoji}</span>}
          title="Nessun allievo"
          message={
            search.trim()
              ? 'Nessun allievo con questo nome.'
              : 'Non ci sono ancora allievi approvati a cui assegnare il percorso.'
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(({ student, attivo, altro, done, percent }) => (
            <div
              key={student.id}
              className="rounded-[var(--radius-lg)] bg-card px-3.5 py-3"
              style={{
                border: `1.5px solid ${
                  attivo ? `${program.colors.accent}59` : 'var(--border-soft)'
                }`,
                boxShadow: attivo ? `0 4px 14px ${program.colors.accent}1A` : undefined,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-[13.5px] font-semibold text-foreground truncate">
                    {student.full_name}
                  </span>
                  {attivo && (
                    <span
                      className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-white"
                      style={{ background: program.colors.accent }}
                    >
                      Attivo
                    </span>
                  )}
                  {altro && (
                    <span
                      className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-[0.08em]"
                      style={{
                        background: KIDS_PROGRAMS[altro].colors.soft,
                        color: KIDS_PROGRAMS[altro].colors.accentDark,
                      }}
                    >
                      {KIDS_PROGRAMS[altro].name}
                    </span>
                  )}
                </span>

                {attivo ? (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={busyId === student.id}
                    icon={<Power size={13} strokeWidth={2.4} />}
                    onClick={() => setConferma({ kind: 'off', student })}
                  >
                    Disattiva
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    loading={busyId === student.id}
                    icon={<PlayCircle size={14} strokeWidth={2.4} />}
                    onClick={() => chiediAttivazione(student)}
                    style={{ backgroundColor: program.colors.accent }}
                  >
                    Attiva
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2.5">
                <div className="flex-1 h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${percent}%`, background: program.colors.accent }}
                  />
                </div>
                <span
                  className="text-[11px] font-bold tabular-nums shrink-0"
                  style={{ color: program.colors.accent }}
                >
                  {done}/{total}
                </span>
                <span className="text-[11px] font-semibold text-subtle-foreground tabular-nums w-9 text-right">
                  {percent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-subtle-foreground leading-relaxed">
        <b>Attiva</b>: l&apos;allievo vede la scheda &laquo;12 passi&raquo; di questo percorso e gli
        obiettivi dei passi sbloccati compaiono nel suo Kanban. Ogni allievo puo&apos; seguire{' '}
        <b>un solo</b> percorso Kids alla volta. <b>Disattiva</b>: toglie il percorso e{' '}
        <b>azzera</b> spunte, livelli conclusi e card dei 12 passi.
      </p>

      <ConfirmDialog
        open={conferma?.kind === 'switch'}
        variant="primary"
        title={`Cambiare percorso a ${nomeBreve(conferma?.student)}?`}
        message={
          conferma?.kind === 'switch'
            ? `${nomeBreve(conferma.student)} sta seguendo il percorso ${
                KIDS_PROGRAMS[conferma.from].name
              }. Attivando ${program.name}, ${
                KIDS_PROGRAMS[conferma.from].name
              } viene disattivato: le spunte gia' fatte restano salvate e si ritrovano se glielo riassegni.`
            : ''
        }
        confirmLabel={`Attiva ${program.name}`}
        onConfirm={() => {
          const c = conferma;
          setConferma(null);
          if (c) void cambia(c.student, program.level);
        }}
        onCancel={() => setConferma(null)}
      />

      {/* La disattivazione cancella dei dati: va confermata, e il testo deve
          dire esattamente cosa si perde (stesso patto della scheda allievo). */}
      <ConfirmDialog
        open={conferma?.kind === 'off'}
        title="Disattivare e azzerare il percorso?"
        message={
          conferma?.kind === 'off'
            ? `${conferma.student.full_name} non vedra' piu' la scheda "12 passi". Verranno cancellate tutte le spunte gia' fatte, i percorsi risultati conclusi e le card dei 12 passi nella sua sezione Obiettivi. Riattivandolo si ripartira' da zero. Gli obiettivi liberi del Kanban non vengono toccati.`
            : ''
        }
        confirmLabel="Disattiva e azzera"
        onConfirm={() => {
          const c = conferma;
          setConferma(null);
          if (c) void cambia(c.student, null);
        }}
        onCancel={() => setConferma(null)}
      />
    </div>
  );
}

/** Cosa sta aspettando una conferma. */
type Conferma =
  | { kind: 'switch'; student: Profile; from: PlayerLevel }
  | { kind: 'off'; student: Profile };

/** Solo il nome di battesimo: "Cambiare percorso a Marco?" suona meglio. */
function nomeBreve(student: Profile | undefined): string {
  if (!student) return 'questo allievo';
  return student.full_name.split(' ')[0] || student.full_name;
}
