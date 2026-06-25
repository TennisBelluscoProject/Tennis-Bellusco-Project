'use client';

/**
 * PathManager — gestione percorsi lato maestro.
 * Lista dei percorsi, creazione/modifica (PathEditor), eliminazione e
 * attivazione per un allievo (materializza i goal via RPC activate_path).
 */

import { useEffect, useState } from 'react';
import type { Path, Profile } from '@/lib/database.types';
import { pathRepo, studentPathRepo, profileRepo } from '@/lib/repositories';
import { useIsMobile } from '@/lib/hooks';
import {
  Button,
  Modal,
  SearchBar,
  Spinner,
  EmptyState,
  ConfirmDialog,
} from './UI';
import { PathEditor } from './PathEditor';

interface Props {
  coachId: string;
}

export function PathManager({ coachId }: Props) {
  const isMobile = useIsMobile();
  // Su mobile la dashboard maestro ha una BottomNav fissa: lasciamo spazio in
  // fondo cosi' il footer dell'editor e la coda della lista non ci finiscano sotto.
  const mobilePad = isMobile ? 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]' : '';
  const [paths, setPaths] = useState<Path[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editing, setEditing] = useState<Path | null>(null);
  const [activateFor, setActivateFor] = useState<Path | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Path | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await pathRepo.list();
      if (!cancelled) {
        setPaths(res.data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const reload = () => setReloadTick((t) => t + 1);

  const handleDelete = async (p: Path) => {
    await pathRepo.delete(p.id);
    setConfirmDelete(null);
    reload();
  };

  if (view === 'editor') {
    return (
      <div className={`flex flex-col h-full min-h-0 animate-fade-in ${mobilePad}`}>
        <PathEditor
          coachId={coachId}
          path={editing}
          onClose={() => setView('list')}
          onSaved={() => {
            setView('list');
            reload();
          }}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full min-h-0 ${mobilePad}`}>
      <div className="shrink-0 flex items-center justify-between mb-3">
        <p className="text-[12px] text-gray-500">
          Crea percorsi a tappe e attivali per gli allievi.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setEditing(null);
            setView('editor');
          }}
        >
          + Nuovo percorso
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : paths.length === 0 ? (
          <EmptyState
            icon={<PathIcon />}
            title="Nessun percorso"
            message="Crea il primo percorso di obiettivi per i tuoi allievi."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {paths.map((p) => (
              <PathCard
                key={p.id}
                path={p}
                onEdit={() => {
                  setEditing(p);
                  setView('editor');
                }}
                onActivate={() => setActivateFor(p)}
                onDelete={() => setConfirmDelete(p)}
              />
            ))}
          </div>
        )}
      </div>

      {activateFor && (
        <ActivateModal
          path={activateFor}
          onClose={() => setActivateFor(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminare il percorso?"
        message={
          confirmDelete
            ? `Eliminare "${confirmDelete.title}"? Verra' rimosso per tutti gli allievi a cui e' attivo, e gli obiettivi delle sue tappe spariranno dalle loro schede.`
            : ''
        }
        confirmLabel="Elimina"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

// ─── Card percorso ───────────────────────────────────────────────────────────

function PathCard({
  path,
  onEdit,
  onActivate,
  onDelete,
}: {
  path: Path;
  onEdit: () => void;
  onActivate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="card p-4 flex flex-col gap-2 animate-fade-in">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-900 tracking-[-0.01em] min-w-0">{path.title}</h3>
        <span
          className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold text-white"
          style={{ backgroundColor: 'var(--club-red)' }}
        >
          {path.difficulty}
        </span>
      </div>
      {path.description && (
        <p className="text-[12px] text-gray-500 line-clamp-2 leading-relaxed">{path.description}</p>
      )}
      <div className="flex items-center gap-2 mt-1 pt-2 border-t border-gray-100">
        <Button variant="secondary" size="sm" onClick={onActivate}>Attiva per allievo</Button>
        <button onClick={onEdit} className="text-[12px] font-semibold text-gray-500 hover:text-[var(--club-blue)] px-2 py-1">
          Modifica
        </button>
        <button onClick={onDelete} className="ml-auto text-gray-300 hover:text-red-500 transition-colors p-1" aria-label="Elimina percorso">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Modal di attivazione (scelta allievo) ───────────────────────────────────

function ActivateModal({ path, onClose }: { path: Path; onClose: () => void }) {
  const [students, setStudents] = useState<Profile[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [stud, act] = await Promise.all([
        profileRepo.listApprovedStudents(),
        studentPathRepo.listActivationsByPath(path.id),
      ]);
      if (cancelled) return;
      setStudents(stud.data ?? []);
      setActiveIds(new Set(act.data ?? []));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [path.id]);

  const filtered = students.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = async (student: Profile) => {
    setError(null);
    setBusyId(student.id);
    const isActive = activeIds.has(student.id);
    const res = isActive
      ? await studentPathRepo.deactivate(path.id, student.id)
      : await studentPathRepo.activate(path.id, student.id);
    setBusyId(null);
    if (res.error) {
      setError(
        `${isActive ? 'Disattivazione' : 'Attivazione'} non riuscita: ${res.error.message}`
      );
      return;
    }
    setActiveIds((prev) => {
      const next = new Set(prev);
      if (isActive) next.delete(student.id);
      else next.add(student.id);
      return next;
    });
  };

  return (
    <Modal open onClose={onClose} title={`Attiva: ${path.title}`}>
      <div className="flex flex-col gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca allievo..." />
        <div className="max-h-[50vh] overflow-y-auto flex flex-col gap-1.5">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <p className="text-[13px] text-gray-400 text-center py-6">Nessun allievo trovato.</p>
          ) : (
            filtered.map((s) => {
              const isActive = activeIds.has(s.id);
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-gray-100">
                  <span className="text-[13px] font-semibold text-gray-800 flex items-center gap-2 min-w-0">
                    <span className="truncate">{s.full_name}</span>
                    {isActive && (
                      <span className="shrink-0 text-[10px] font-bold text-[var(--success)] uppercase tracking-wider">Attivo</span>
                    )}
                  </span>
                  <Button
                    variant={isActive ? 'ghost' : 'secondary'}
                    size="sm"
                    onClick={() => toggle(s)}
                    loading={busyId === s.id}
                  >
                    {isActive ? 'Disattiva' : 'Attiva'}
                  </Button>
                </div>
              );
            })
          )}
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          <b>Attiva</b>: le tappe del percorso diventano obiettivi dell&apos;allievo (quelle sbloccate compaiono anche nel suo Kanban). <b>Disattiva</b>: rimuove il percorso e <b>elimina</b> tutti gli obiettivi creati dalle sue tappe; gli obiettivi liberi non vengono toccati.
        </p>
        {error && <p className="text-[12px] font-medium text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

function PathIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="12" r="3" />
      <path d="M9 6h3a3 3 0 0 1 3 3v0M9 18h3a3 3 0 0 0 3-3v0" />
    </svg>
  );
}
