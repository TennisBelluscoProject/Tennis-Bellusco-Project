'use client';

/**
 * KidsPathCatalog — la sezione "Percorsi Kids" del catalogo maestro.
 *
 * Mostra i TRE percorsi dei 12 passi (Delfino, Cerbiatto, Coccodrillo),
 * ognuno con il colore del proprio livello. Aprendone uno si puo':
 *   - sfogliare il contenuto delle 6 tappe (anteprima in sola lettura)
 *   - vedere a che punto e' ogni allievo di quel livello
 *
 * Le spunte si mettono dalla scheda del singolo allievo (tab "Percorso Kids"),
 * qui il maestro ha la visione d'insieme.
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { PlayerLevel, Profile } from '@/lib/database.types';
import { kidsPathRepo, profileRepo } from '@/lib/repositories';
import { getDisplayRanking } from '@/lib/constants';
import {
  KIDS_PROGRAM_LIST,
  KIDS_PROGRAMS,
  kidsLevelOf,
  kidsTotalObjectives,
  type KidsProgram,
} from '@/lib/kids/curriculum';
import { computeKidsState } from '@/lib/kids/progress';
import { Spinner, EmptyState, SearchBar } from '@/components/UI';
import { useIsMobile } from '@/lib/hooks';
import { KidsPathMap, FULL_BLEED_AT } from './KidsPathMap';
import { KidsStepSheet } from './KidsStepSheet';

interface Props {
  /** Apre la scheda di un allievo (per mettere le spunte). */
  onOpenStudent?: (student: Profile) => void;
}

export function KidsPathCatalog({ onOpenStudent }: Props) {
  const [openLevel, setOpenLevel] = useState<PlayerLevel | null>(null);

  if (openLevel) {
    return (
      <KidsProgramDetail
        program={KIDS_PROGRAMS[openLevel]}
        onBack={() => setOpenLevel(null)}
        onOpenStudent={onOpenStudent}
      />
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <p className="shrink-0 text-[12px] text-gray-500 mb-3">
        I tre percorsi da 12 passi del Diario del Tennis. Ogni allievo segue
        automaticamente quello del proprio livello.
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
          {KIDS_PROGRAM_LIST.map((p) => (
            <ProgramCard key={p.level} program={p} onOpen={() => setOpenLevel(p.level)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Card di un percorso ────────────────────────────────────────────────────

function ProgramCard({ program, onOpen }: { program: KidsProgram; onOpen: () => void }) {
  const c = program.colors;
  const total = kidsTotalObjectives(program);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left rounded-2xl overflow-hidden border-2 transition-all duration-200 hover:-translate-y-0.5 animate-fade-in"
      style={{ borderColor: c.accent, background: '#fff', boxShadow: 'var(--shadow-xs)' }}
    >
      <div className="px-4 py-3 flex items-center gap-2.5" style={{ background: c.accent }}>
        <span className="text-xl leading-none">{program.emoji}</span>
        <div className="min-w-0">
          <h3
            className="text-[15px] font-bold text-white tracking-[-0.01em] truncate"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Percorso {program.name}
          </h3>
          <p className="text-[11px] text-white/75 truncate">{program.headline}</p>
        </div>
      </div>

      <div className="p-4" style={{ background: c.soft }}>
        <p className="text-[12px] text-gray-600 leading-relaxed line-clamp-3">{program.intro}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Chip color={c.accentDark}>12 passi</Chip>
          <Chip color={c.accentDark}>6 cancelli</Chip>
          <Chip color={c.accentDark}>{total} obiettivi</Chip>
        </div>
      </div>
    </button>
  );
}

function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-white/70"
      style={{ color }}
    >
      {children}
    </span>
  );
}

// ─── Dettaglio di un percorso ───────────────────────────────────────────────

function KidsProgramDetail({
  program,
  onBack,
  onOpenStudent,
}: {
  program: KidsProgram;
  onBack: () => void;
  onOpenStudent?: (student: Profile) => void;
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
          className="inline-flex items-center gap-1 text-[13px] font-medium text-gray-500 hover:text-[var(--club-blue)] transition-colors"
        >
          <ChevronLeft size={16} />
          Percorsi Kids
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-[13px] font-bold" style={{ color: program.colors.accent }}>
          {program.emoji} {program.name}
        </span>
      </div>

      <div className="shrink-0 flex gap-2 mb-4">
        {(['passi', 'allievi'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors"
            style={{
              background: view === v ? program.colors.accent : '#fff',
              borderColor: view === v ? program.colors.accent : '#E2E4E9',
              color: view === v ? '#fff' : '#6B7280',
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
            <div
              className="rounded-xl px-4 py-3 mb-4 text-[12px] leading-relaxed"
              style={{ background: program.colors.soft, color: program.colors.accentDark }}
            >
              {program.intro}
            </div>
            <KidsPathMap state={preview} onOpenStep={setOpenStep} detail={schedaPasso} />
          </>
        ) : (
          <StudentProgressList program={program} onOpenStudent={onOpenStudent} />
        )}
      </div>
    </div>
  );
}

// ─── Elenco allievi con avanzamento ─────────────────────────────────────────

function StudentProgressList({
  program,
  onOpenStudent,
}: {
  program: KidsProgram;
  onOpenStudent?: (student: Profile) => void;
}) {
  const [students, setStudents] = useState<Profile[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
      setStudents(stud.data ?? []);
      setCounts(new Map((cnt.data ?? []).map((r) => [r.studentId, r.done])));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [program.level]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter((s) => kidsLevelOf(getDisplayRanking(s).displayLevel) === program.level)
      .filter((s) => (q ? s.full_name.toLowerCase().includes(q) : true))
      .map((s) => {
        const done = counts.get(s.id) ?? 0;
        return { student: s, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
      })
      .sort((a, b) => b.done - a.done || a.student.full_name.localeCompare(b.student.full_name));
  }, [students, counts, search, program.level, total]);

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

      {rows.length === 0 ? (
        <EmptyState
          icon={<span className="text-4xl">{program.emoji}</span>}
          title={`Nessun allievo ${program.name}`}
          message={`Nessun allievo ha attualmente il livello ${program.name}. Il livello si imposta dalla scheda dell\u2019allievo.`}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(({ student, done, percent }) => {
            // Quanti passi sono conclusi: ricalcolo esatto non disponibile qui
            // (servirebbero le chiavi), quindi mostriamo obiettivi e percentuale.
            return (
              <button
                key={student.id}
                type="button"
                onClick={() => onOpenStudent?.(student)}
                className="w-full text-left rounded-xl border border-gray-100 bg-white px-3.5 py-3 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13.5px] font-semibold text-gray-800 truncate">
                    {student.full_name}
                  </span>
                  <span
                    className="text-[12px] font-bold tabular-nums shrink-0"
                    style={{ color: program.colors.accent }}
                  >
                    {done}/{total}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%`, background: program.colors.accent }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-400 tabular-nums w-9 text-right">
                    {percent}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
