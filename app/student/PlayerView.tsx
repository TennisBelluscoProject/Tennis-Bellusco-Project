'use client';

import { useState, useEffect, useCallback } from 'react';
import { Target, Trophy, Trash2 } from 'lucide-react';
import { goalRepo, matchRepo, studentPathRepo, pathRepo } from '@/lib/repositories';
import type { ActiveStudentPath } from '@/lib/repositories';
import { Button, Tabs, Spinner, EmptyState, ConfirmDialog } from '@/components/UI';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import type { Profile, Goal, MatchResultRow, GoalStatus, PlayerLevel } from '@/lib/database.types';
import { getDisplayRanking, getAgeCategory, isClassified, LEVELS, PATHS_PREVIEW } from '@/lib/constants';
import { KanbanBoard } from '@/components/KanbanBoard';
import { PathTreeView, type PathTreeData } from '@/components/PathTreeView';
import { computePathState } from '@/lib/paths/topo';
import { GoalForm } from '@/components/GoalForm';
import { MatchCard } from '@/components/MatchCard';
import { MatchForm } from '@/components/MatchForm';
import { CoachNotesForm } from '@/components/CoachNotesForm';
import { DeleteFictitiousStudentDialog } from '@/app/coach/components/DeleteFictitiousStudentDialog';
import { useIsMobile } from '@/lib/hooks';

export type PlayerViewMode = 'self' | 'coach';

interface PlayerViewProps {
  player: Profile;
  mode: PlayerViewMode;
  writerId: string;
  onEditProfile?: () => void;
  onBack?: () => void;
  onDataChanged?: () => void;
}

export function PlayerView({
  player,
  mode,
  writerId,
  onEditProfile,
  onBack,
  onDataChanged,
}: PlayerViewProps) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<'obiettivi' | 'match' | 'percorso'>('obiettivi');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [matches, setMatches] = useState<MatchResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [matchFormOpen, setMatchFormOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<MatchResultRow | null>(null);
  const [coachNotesOpen, setCoachNotesOpen] = useState(false);
  const [coachNotesMatch, setCoachNotesMatch] = useState<MatchResultRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [reloadTick, setReloadTick] = useState(0);
  const refetch = useCallback(() => setReloadTick((t) => t + 1), []);

  // ─── Percorso (skill tree) ──────────────────────────
  const [activePaths, setActivePaths] = useState<ActiveStudentPath[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [pathViews, setPathViews] = useState<Record<string, PathTreeData>>({});
  const [deactivatePathOpen, setDeactivatePathOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Carica tutto in un colpo: obiettivi liberi, match e percorsi attivi (con
  // grafo + goal materializzati). Calcola la frontiera sbloccata (Kahn) e
  // costruisce sia la lista del Kanban (liberi + nodi SBLOCCATI) sia il
  // view-model dell'albero per ogni percorso (tutti i nodi).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [freeRes, matchRes, activeRes] = await Promise.all([
        goalRepo.listByStudent(player.id),
        matchRepo.listByStudent(player.id),
        studentPathRepo.listActiveByStudent(player.id),
      ]);
      const free = freeRes.data ?? [];
      const actives = activeRes.data ?? [];

      const loaded = await Promise.all(
        actives.map(async (ap) => {
          const [graphRes, pgRes] = await Promise.all([
            pathRepo.getGraph(ap.path.id),
            goalRepo.listByStudentPath(player.id, ap.path.id),
          ]);
          return {
            ap,
            graph: graphRes.data ?? { nodes: [], edges: [] },
            pathGoals: pgRes.data ?? [],
          };
        })
      );
      if (cancelled) return;

      const unlockedPathGoals: Goal[] = [];
      const views: Record<string, PathTreeData> = {};

      for (const L of loaded) {
        const edges = L.graph.edges.map((e) => ({ from: e.from_node_id, to: e.to_node_id }));
        const completion = new Set(
          L.pathGoals
            .filter((x) => x.status === 'completed' && x.path_node_id)
            .map((x) => x.path_node_id as string)
        );
        const state = computePathState(
          L.graph.nodes.map((n) => ({ id: n.id })),
          edges,
          completion
        );
        const goalByNode = new Map(
          L.pathGoals.filter((x) => x.path_node_id).map((x) => [x.path_node_id as string, x])
        );
        // Kanban: includi i goal dei nodi SBLOCCATI (i bloccati restano nascosti).
        for (const n of L.graph.nodes) {
          const goal = goalByNode.get(n.id);
          if (goal && state.unlocked[n.id]) unlockedPathGoals.push(goal);
        }
        // Albero: tutti i nodi (anche bloccati).
        views[L.ap.path.id] = {
          title: L.ap.path.title,
          difficulty: L.ap.path.difficulty,
          nodes: L.graph.nodes.map((n) => {
            const g = goalByNode.get(n.id);
            return {
              id: n.id,
              title: n.title,
              category: n.category,
              description: n.description,
              status: g ? g.status : null,
              progress: g ? g.progress : 0,
              goalId: g ? g.id : undefined,
            };
          }),
          edges,
        };
      }

      setGoals([...free, ...unlockedPathGoals]);
      setMatches(matchRes.data ?? []);
      setActivePaths(actives);
      setPathViews(views);
      setSelectedPathId((cur) =>
        cur && actives.some((a) => a.path.id === cur) ? cur : actives[0]?.path.id ?? null
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [player.id, reloadTick]);

  const isCoach = mode === 'coach';

  const activeGoals = goals.filter((g) => g.status !== 'completed').length;
  const wins = matches.filter((m) => m.result === 'win').length;
  const totalMatches = matches.length;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  const { displayLevel, displayRanking } = getDisplayRanking(player);
  const classified = isClassified(displayRanking);
  const ageCategory = getAgeCategory(player.birth_date);
  const normalizedLevel: PlayerLevel | undefined = (LEVELS as readonly string[]).includes(displayLevel)
    ? (displayLevel as PlayerLevel)
    : undefined;

  const triggerRefresh = async () => {
    refetch();
    onDataChanged?.();
  };

  const handleSaveGoal = async (data: Partial<Goal>) => {
    if (editingGoal) {
      await goalRepo.update(editingGoal.id, data);
    } else {
      await goalRepo.create({ studentId: player.id, createdBy: writerId, data });
    }
    await triggerRefresh();
    setEditingGoal(null);
  };

  const handleDeleteGoal = async (id: string) => {
    await goalRepo.delete(id);
    await triggerRefresh();
  };

  const handleGoalStatusChange = async (id: string, status: GoalStatus) => {
    await goalRepo.changeStatus(id, status);
    await triggerRefresh();
  };

  const handleGoalProgressChange = async (id: string, progress: number) => {
    await goalRepo.setProgress(id, progress);
    // Optimistic local update — keeps the slider responsive without waiting
    // for a full refetch round-trip.
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, progress } : g)));
  };

  // ─── Azioni sui nodi del percorso ───────────────────
  const handlePathStart = async (goalId: string) => {
    await goalRepo.changeStatus(goalId, 'in_progress');
    await triggerRefresh();
  };
  const handlePathComplete = async (goalId: string) => {
    await goalRepo.changeStatus(goalId, 'completed');
    await triggerRefresh(); // il ricalcolo sblocca i nodi successivi (animazione)
  };
  const handlePathProgress = async (goalId: string, value: number) => {
    await goalRepo.setProgress(goalId, value);
    // Optimistic: aggiorna albero e Kanban senza ricaricare (il progresso non
    // cambia la frontiera di sblocco).
    setPathViews((prev) => {
      const next: Record<string, PathTreeData> = {};
      for (const [pid, v] of Object.entries(prev)) {
        next[pid] = {
          ...v,
          nodes: v.nodes.map((n) => (n.goalId === goalId ? { ...n, progress: value } : n)),
        };
      }
      return next;
    });
    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, progress: value } : g)));
  };

  // Solo maestro: disattiva il percorso selezionato per QUESTO allievo.
  // La RPC `deactivate_path` rimuove l'istanza student_paths e CANCELLA gli
  // obiettivi materializzati da quel percorso per l'allievo.
  const handleDeactivatePath = async () => {
    if (!selectedPathId || deactivating) return;
    setDeactivating(true);
    await studentPathRepo.deactivate(selectedPathId, player.id);
    setDeactivating(false);
    setDeactivatePathOpen(false);
    await triggerRefresh();
  };

  const handleSaveMatch = async (data: Partial<MatchResultRow>) => {
    if (editingMatch) {
      await matchRepo.update(editingMatch.id, data);
    } else {
      await matchRepo.create({ studentId: player.id, data });
    }
    await triggerRefresh();
    setEditingMatch(null);
  };

  const handleDeleteMatch = async (id: string) => {
    await matchRepo.delete(id);
    await triggerRefresh();
  };

  const handleSaveCoachNotes = async (notes: string) => {
    if (coachNotesMatch) {
      await matchRepo.setCoachNotes(coachNotesMatch.id, notes || null);
      await triggerRefresh();
    }
  };

  const handleFab = () => {
    if (tab === 'obiettivi') {
      setEditingGoal(null);
      setGoalFormOpen(true);
    } else {
      setEditingMatch(null);
      setMatchFormOpen(true);
    }
  };

  const backLink = isCoach && onBack && (
    <button
      onClick={onBack}
      className="flex items-center gap-2 text-[13px] font-medium text-gray-500 hover:text-[var(--club-blue)] mb-4 transition-colors group shrink-0"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="group-hover:-translate-x-0.5 transition-transform"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Torna agli allievi
    </button>
  );

  const heroCard = (
    <div
      className="rounded-2xl shadow-sm overflow-hidden mb-6 animate-slide-up relative shrink-0"
      style={{
        background:
          'linear-gradient(135deg, var(--club-blue-dark) 0%, var(--club-blue) 100%)',
      }}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 ring-1 ring-white/15">
            <AvatarDisplay
              photoUrl={player.photo_url}
              fullName={player.full_name}
              size={64}
              className="ring-0 shadow-none w-full h-full"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              className="text-xl sm:text-2xl font-bold text-white tracking-[-0.02em] truncate"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {player.full_name}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {ageCategory && <DarkBadge accent="#60A5FA">{ageCategory}</DarkBadge>}
              {classified ? (
                <DarkBadge accent="#FCA5A5">FIT: {displayRanking}</DarkBadge>
              ) : (
                <>
                  <DarkBadge accent="#FCD34D">{displayLevel}</DarkBadge>
                  <DarkBadge accent="rgba(255,255,255,0.55)">Non classificato</DarkBadge>
                </>
              )}
            </div>
          </div>
          {mode === 'self' && onEditProfile && (
            <button
              onClick={onEditProfile}
              className="text-[12px] font-semibold text-white/80 hover:text-white px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors shrink-0"
            >
              Modifica
            </button>
          )}
          {isCoach && player.is_fictitious && (
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-200 hover:text-white px-3 py-1.5 rounded-lg border border-red-300/30 hover:border-red-300/60 hover:bg-red-500/15 transition-colors shrink-0"
              title="Elimina allievo gestito"
            >
              <Trash2 size={14} strokeWidth={2.2} />
              Elimina
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 mt-5 pt-5 border-t border-white/10">
          <StatCol value={activeGoals} label="Obiettivi" tone="blue" />
          <StatCol value={wins} label="Vittorie" tone="green" />
          <StatCol value={totalMatches} label="Match" tone="white" />
          <StatCol value={`${winRate}%`} label="Win Rate" tone="amber" />
        </div>
      </div>
    </div>
  );

  const tabsBar = (
    <Tabs
      tabs={[
        { id: 'obiettivi', label: 'Obiettivi' },
        ...(PATHS_PREVIEW ? [{ id: 'percorso', label: 'Il mio percorso' }] : []),
        { id: 'match', label: 'Match' },
      ]}
      active={tab}
      onChange={(v) => setTab(v as 'obiettivi' | 'match' | 'percorso')}
    />
  );

  const addMatchButton = (
    <div className="hidden sm:flex justify-end">
      <Button
        variant="primary"
        onClick={() => {
          setEditingMatch(null);
          setMatchFormOpen(true);
        }}
      >
        + Aggiungi Match
      </Button>
    </div>
  );

  const addGoalButton = (
    <div className="hidden sm:flex justify-end mb-4">
      <Button
        variant="primary"
        onClick={() => {
          setEditingGoal(null);
          setGoalFormOpen(true);
        }}
      >
        + Nuovo obiettivo
      </Button>
    </div>
  );

  const goalsContent =
    goals.length === 0 ? (
      <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center">
        <EmptyState
          icon={<Target size={40} strokeWidth={1.5} />}
          title="Nessun obiettivo"
          message={
            isCoach
              ? "Crea il primo obiettivo per questo allievo."
              : "Crea il tuo primo obiettivo per iniziare il tuo percorso!"
          }
          action={
            <Button
              variant="primary"
              onClick={() => {
                setEditingGoal(null);
                setGoalFormOpen(true);
              }}
            >
              Crea obiettivo
            </Button>
          }
        />
      </div>
    ) : (
      <KanbanBoard
        goals={goals}
        isCoach={isCoach}
        onEdit={(g) => {
          setEditingGoal(g);
          setGoalFormOpen(true);
        }}
        onDelete={handleDeleteGoal}
        onStatusChange={handleGoalStatusChange}
        onProgressChange={handleGoalProgressChange}
      />
    );

  const matchesContent =
    matches.length === 0 ? (
      <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center">
        <EmptyState
          icon={<Trophy size={40} strokeWidth={1.5} />}
          title="Nessun match"
          message={
            isCoach
              ? "Questo allievo non ha ancora registrato match."
              : "Registra il tuo primo match agonistico!"
          }
          action={
            <Button
              variant="primary"
              onClick={() => {
                setEditingMatch(null);
                setMatchFormOpen(true);
              }}
            >
              Aggiungi match
            </Button>
          }
        />
      </div>
    ) : (
      <div className="flex-1 min-h-0 overflow-y-auto pb-6 w-full overscroll-contain px-0.5 -mx-0.5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-children w-full content-start">
          {matches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              isCoach={isCoach}
              onEdit={(mm) => {
                setEditingMatch(mm);
                setMatchFormOpen(true);
              }}
              onDelete={handleDeleteMatch}
              onEditCoachNotes={
                isCoach
                  ? (mm) => {
                      setCoachNotesMatch(mm);
                      setCoachNotesOpen(true);
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    );

  const pathData = selectedPathId ? pathViews[selectedPathId] ?? null : null;

  const percorsoContent = (
    <div className="flex flex-col min-h-full">
      {activePaths.length > 1 && (
        <div className="shrink-0 flex gap-2 mb-3 overflow-x-auto scrollbar-hidden">
          {activePaths.map((ap) => (
            <button
              key={ap.path.id}
              onClick={() => setSelectedPathId(ap.path.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
                selectedPathId === ap.path.id
                  ? 'bg-[var(--club-blue)] text-white border-[var(--club-blue)]'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {ap.path.title}
            </button>
          ))}
        </div>
      )}
      {loading && !pathData ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : !pathData ? (
        <div className="flex-1 flex items-center justify-center py-10">
          <EmptyState
            icon={<Target size={40} strokeWidth={1.5} />}
            title="Nessun percorso attivo"
            message={
              isCoach
                ? 'Attiva un percorso per questo allievo dalla sezione Catalogo › Percorsi.'
                : 'Il tuo maestro non ti ha ancora assegnato un percorso.'
            }
          />
        </div>
      ) : (
        <PathTreeView
          data={pathData}
          onStart={handlePathStart}
          onProgress={handlePathProgress}
          onComplete={handlePathComplete}
          onDeactivate={isCoach ? () => setDeactivatePathOpen(true) : undefined}
        />
      )}
    </div>
  );

  const layoutContents = isMobile ? (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {backLink}
      {heroCard}
      <div className="shrink-0">{tabsBar}</div>
      <div className="mt-5 flex-1 min-h-0 flex flex-col justify-stretch">
        {loading ? (
          <div className="flex justify-center py-12 flex-1">
            <Spinner />
          </div>
        ) : tab === 'obiettivi' ? (
          <>{goalsContent}</>
        ) : tab === 'percorso' ? (
          // Lo scroll sta sul contenitore: l'albero del percorso non ha piu'
          // una scrollbar interna e scorre insieme a tutto il contenuto.
          <div className="flex-1 min-h-0 overflow-y-auto pb-6">{percorsoContent}</div>
        ) : (
          <>{matchesContent}</>
        )}
      </div>
    </div>
  ) : tab === 'match' ? (
    <>
      {backLink}
      <div className="sticky top-16 z-20 bg-[var(--background)] -mx-4 sm:-mx-6 px-4 sm:px-6 pt-1 pb-4">
        {heroCard}
        {tabsBar}
        <div className="mt-4">{addMatchButton}</div>
      </div>
      <div className="mt-5">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          matchesContent
        )}
      </div>
    </>
  ) : tab === 'percorso' ? (
    <>
      {backLink}
      {heroCard}
      {tabsBar}
      {/* Nessuna altezza fissa: l'albero cresce e scorre con la pagina. */}
      <div className="mt-5">{percorsoContent}</div>
    </>
  ) : (
    <>
      {backLink}
      {heroCard}
      {tabsBar}
      <div className="mt-5">
        {addGoalButton}
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          goalsContent
        )}
      </div>
    </>
  );

  return (
    <>
      {layoutContents}

      {tab !== 'percorso' && (
        <button
          onClick={handleFab}
          className="sm:hidden fab"
          aria-label={tab === 'obiettivi' ? 'Nuovo obiettivo' : 'Aggiungi match'}
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      <GoalForm
        open={goalFormOpen}
        onClose={() => {
          setGoalFormOpen(false);
          setEditingGoal(null);
        }}
        onSave={handleSaveGoal}
        goal={editingGoal}
        isCoach={isCoach}
        playerLevel={normalizedLevel}
      />
      <MatchForm
        open={matchFormOpen}
        onClose={() => {
          setMatchFormOpen(false);
          setEditingMatch(null);
        }}
        onSave={handleSaveMatch}
        match={editingMatch}
      />
      {isCoach && (
        <CoachNotesForm
          open={coachNotesOpen}
          onClose={() => {
            setCoachNotesOpen(false);
            setCoachNotesMatch(null);
          }}
          onSave={handleSaveCoachNotes}
          currentNotes={coachNotesMatch?.coach_notes}
        />
      )}
      {isCoach && (
        <ConfirmDialog
          open={deactivatePathOpen}
          title="Disattivare il percorso?"
          message={`Il percorso "${pathData?.title ?? ''}" verra' rimosso per ${player.full_name} e tutti gli obiettivi creati da questo percorso verranno eliminati dalla sua scheda. Gli obiettivi liberi del Kanban non vengono toccati.`}
          confirmLabel="Disattiva"
          onConfirm={handleDeactivatePath}
          onCancel={() => setDeactivatePathOpen(false)}
        />
      )}
      {isCoach && player.is_fictitious && (
        <DeleteFictitiousStudentDialog
          open={deleteDialogOpen}
          student={player}
          onClose={() => setDeleteDialogOpen(false)}
          onDeleted={() => {
            setDeleteDialogOpen(false);
            onDataChanged?.();
            onBack?.();
          }}
        />
      )}
    </>
  );
}

function DarkBadge({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-[0.01em]"
      style={{
        background: 'rgba(255,255,255,0.08)',
        color: accent,
        border: `1px solid rgba(255,255,255,0.14)`,
      }}
    >
      {children}
    </span>
  );
}

function StatCol({
  value,
  label,
  tone,
}: {
  value: string | number;
  label: string;
  tone: 'blue' | 'green' | 'white' | 'amber' | 'red';
}) {
  const colors: Record<string, string> = {
    blue: '#60A5FA',
    green: '#4ADE80',
    white: '#F3F4F6',
    amber: '#FCD34D',
    red: '#FCA5A5',
  };
  return (
    <div className="text-center">
      <p className="text-[22px] sm:text-2xl font-bold tracking-[-0.02em]" style={{ color: colors[tone] }}>
        {value}
      </p>
      <p className="text-[10px] font-semibold text-white/55 uppercase tracking-[0.08em] mt-1">
        {label}
      </p>
    </div>
  );
}
