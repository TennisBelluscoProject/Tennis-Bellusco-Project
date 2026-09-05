'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronLeft, Pencil, Plus, Target, Trophy, Trash2, Users } from 'lucide-react';
import { goalRepo, matchRepo, studentPathRepo, pathRepo, kidsPathRepo } from '@/lib/repositories';
import type { ActiveStudentPath } from '@/lib/repositories';
import {
  AnimatedNumber,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Spinner,
  Tabs,
} from '@/components/UI';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import type { Profile, Goal, MatchResultRow, GoalStatus, PlayerLevel } from '@/lib/database.types';
import { getDisplayRanking, getAgeCategory, isClassified, LEVELS, PATHS_PREVIEW, KIDS_PATHS } from '@/lib/constants';
import { KanbanBoard } from '@/components/KanbanBoard';
import { KidsPathSection } from '@/components/kids/KidsPathSection';
import { PathTreeView, type PathTreeData } from '@/components/PathTreeView';
import { computePathState } from '@/lib/paths/topo';
import { applyStatus } from '@/components/kanban/goal-utils';
import { isEmptyPlan, visibleKidsGoals } from '@/lib/kids/goals';
import { GoalForm } from '@/components/GoalForm';
import { MatchCard } from '@/components/MatchCard';
import { MatchForm } from '@/components/MatchForm';
import { CoachNotesForm } from '@/components/CoachNotesForm';
import { DeleteFictitiousStudentDialog } from '@/app/coach/components/DeleteFictitiousStudentDialog';
import { GroupMembersPanel } from '@/app/coach/components/GroupMembersPanel';
import { useIsMobile } from '@/lib/hooks';

export type PlayerViewMode = 'self' | 'coach';

/** Le schede della vista allievo. */
type PlayerTab = 'obiettivi' | 'percorso' | 'kids' | 'match';

interface PlayerViewProps {
  /**
   * Il soggetto della scheda. Di norma un allievo, ma puo' essere anche un
   * GRUPPO di lezione (`is_group = true`): dal punto di vista di obiettivi e
   * percorsi le due cose si comportano allo stesso modo, ed e' esattamente il
   * motivo per cui i gruppi sono righe di `profiles` (ADR-5-1).
   */
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
  const [tab, setTab] = useState<PlayerTab>('obiettivi');
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
  /** Statistiche della testata: chiuse di default, si aprono con la freccina. */
  const [statsOpen, setStatsOpen] = useState(false);

  const [reloadTick, setReloadTick] = useState(0);
  /**
   * Una ricarica "silenziosa" rilegge tutto senza accendere lo spinner.
   *
   * Serve dopo la conclusione di un nodo di percorso: quel gesto sblocca i
   * nodi successivi, e la frontiera la sa calcolare solo l'effetto qui sotto.
   * Ma smontare il Kanban per mezzo secondo dopo ogni completamento e' proprio
   * lo scatto che si voleva togliere — quindi la lettura avviene sotto, e a
   * schermo resta la lista gia' aggiornata dall'ottimismo.
   */
  const silentReload = useRef(false);
  const refetch = useCallback((silent = false) => {
    silentReload.current = silent;
    setReloadTick((t) => t + 1);
  }, []);

  // ─── Percorso (skill tree) ──────────────────────────
  const [activePaths, setActivePaths] = useState<ActiveStudentPath[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [pathViews, setPathViews] = useState<Record<string, PathTreeData>>({});
  const [deactivatePathOpen, setDeactivatePathOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  /**
   * Errore dell'ultima disattivazione di un Percorso (skill tree).
   *
   * Prima l'esito della RPC veniva ignorato: se `deactivate_path` falliva
   * (permessi, rete, riga non trovata) la finestra si chiudeva lo stesso e
   * partiva un ricaricamento, che ovviamente ritrovava il percorso ancora
   * attivo. Da fuori sembrava che il clic non avesse fatto niente.
   */
  const [pathError, setPathError] = useState<string | null>(null);

  /**
   * Percorso Kids attivo per questo allievo: NULL = nessuno. Non si deduce
   * piu' dal livello, lo decide il maestro.
   *
   * E' STATO LOCALE, non il prop, e la differenza non e' cosmetica.
   *
   * L'allievo aperto sta nel `selectedStudent` del chiamante, che `fetchAll()`
   * NON riaggiorna: ricarica l'elenco, ma l'oggetto gia' selezionato resta
   * quello di prima. Quindi dopo una disattivazione `player.kids_path_level`
   * continuava a valere il percorso appena spento, con due conseguenze:
   *
   *   1. l'effetto qui sotto non ripartiva (la sua dipendenza non cambiava) e
   *      il Kanban restava pieno di card che nel database erano gia' state
   *      cancellate;
   *   2. soprattutto, quell'effetto chiama `syncGoals` su `kidsLevel`. Al
   *      primo ricaricamento successivo la sincronizzazione girava ancora sul
   *      percorso disattivato e RICREAVA le card dei primi due passi. La
   *      cancellazione avveniva davvero, e poi veniva disfatta da sola.
   *
   * Tenendolo qui, `onLevelChanged` lo aggiorna al momento e tutto si
   * riallinea senza dipendere da quando (e se) il chiamante rilegge il
   * profilo.
   */
  const [kidsLevel, setKidsLevel] = useState<PlayerLevel | null>(
    player.kids_path_level
  );
  // Se il chiamante RIESCE a passare un profilo aggiornato, quello vince.
  // La dipendenza e' il VALORE, non l'oggetto: un profilo riletto ma identico
  // non sovrascrive quanto appena deciso qui.
  useEffect(() => {
    setKidsLevel(player.kids_path_level);
  }, [player.kids_path_level]);

  // Carica tutto in un colpo: obiettivi liberi, match e percorsi attivi (con
  // grafo + goal materializzati). Calcola la frontiera sbloccata (Kahn) e
  // costruisce sia la lista del Kanban (liberi + nodi SBLOCCATI) sia il
  // view-model dell'albero per ogni percorso (tutti i nodi).
  //
  // In parallelo allinea le card dei 12 passi Kids: quelle dei passi appena
  // sbloccati vanno materializzate anche se l'allievo non apre mai la scheda
  // "12 passi", altrimenti la sezione Obiettivi resterebbe indietro.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Lo spinner si accende solo per le letture che l'utente sta
      // aspettando. Quelle di riallineamento avvengono in silenzio.
      const silent = silentReload.current;
      silentReload.current = false;
      if (!silent) setLoading(true);
      const [freeRes, matchRes, activeRes, kidsSyncRes] = await Promise.all([
        goalRepo.listByStudent(player.id),
        matchRepo.listByStudent(player.id),
        studentPathRepo.listActiveByStudent(player.id),
        KIDS_PATHS && kidsLevel
          ? kidsPathRepo.syncGoals({
              studentId: player.id,
              level: kidsLevel,
              actorId: writerId,
            })
          : Promise.resolve(null),
      ]);
      // Le card dei percorsi Kids PRECEDENTI restano in tabella quando il
      // maestro cambia percorso all'allievo (il cambio non azzera, vedi
      // setKidsPath). Qui si tengono solo quelle del percorso attivo, piu'
      // tutte le card libere e lo storico gia' concluso: vedi
      // visibleKidsGoals in lib/kids/goals.ts.
      const soloPercorsoAttivo = (elenco: Goal[]) =>
        KIDS_PATHS ? visibleKidsGoals(elenco, kidsLevel) : elenco;

      let free = soloPercorsoAttivo(freeRes.data ?? []);
      // Nel caso normale la sincronizzazione non ha nulla da fare e la lista
      // appena letta e' buona. Si rilegge solo se ha creato o rimosso card.
      if (kidsSyncRes?.data && !isEmptyPlan(kidsSyncRes.data)) {
        const rilettura = await goalRepo.listByStudent(player.id);
        if (rilettura.data) free = soloPercorsoAttivo(rilettura.data);
      }
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
  }, [player.id, reloadTick, writerId, kidsLevel]);

  const isCoach = mode === 'coach';
  // Un gruppo non ha eta', classifica FIT ne' match: e' un soggetto
  // collettivo. Cambia la testata e sparisce la scheda Match; obiettivi,
  // percorsi e 12 passi restano identici.
  const isGroup = player.is_group;

  const activeGoals = goals.filter((g) => g.status !== 'completed').length;
  const doneGoals = goals.filter((g) => g.status === 'completed').length;
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

  /** Anche l'eliminazione e' immediata: la card sparisce, poi si scrive. */
  const handleDeleteGoal = async (id: string) => {
    const before = goals;
    setGoals((prev) => prev.filter((g) => g.id !== id));
    const res = await goalRepo.delete(id);
    if (res.error) {
      setGoals(before);
      return;
    }
    onDataChanged?.();
  };

  /**
   * Spostamento di un obiettivo fra le colonne del Kanban.
   *
   * Prima si scriveva sul database, poi si rileggeva tutto: mezzo secondo di
   * spinner a ogni trascinamento. Adesso la lista cambia sul momento e la
   * scrittura viaggia dietro; se fallisce, la card torna dov'era.
   *
   * L'unica lettura che resta e' quella dei nodi di percorso, perche'
   * concluderne uno ne sblocca altri e la nuova frontiera la calcola
   * l'effetto di caricamento. Avviene in silenzio, senza spinner.
   */
  const handleGoalStatusChange = async (id: string, status: GoalStatus) => {
    const before = goals.find((g) => g.id === id);
    if (!before || before.status === status) return;

    setGoals((prev) => prev.map((g) => (g.id === id ? applyStatus(g, status) : g)));

    const res = await goalRepo.changeStatus(id, status);
    if (res.error || !res.data) {
      setGoals((prev) => prev.map((g) => (g.id === id ? before : g)));
      return;
    }
    // La riga tornata dal database e' la verita': la si rispecchia, cosi'
    // eventuali campi calcolati dai trigger arrivano senza una lettura in piu'.
    const saved = res.data;
    setGoals((prev) => prev.map((g) => (g.id === id ? saved : g)));

    if (before.path_node_id) refetch(true);
    onDataChanged?.();
  };

  const handleGoalProgressChange = async (id: string, progress: number) => {
    // Il cursore si e' gia' mosso sotto il dito: la copia in memoria lo segue
    // subito e la scrittura arriva dietro.
    const before = goals.find((g) => g.id === id);
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, progress } : g)));
    const res = await goalRepo.setProgress(id, progress);
    if (res.error && before) {
      setGoals((prev) => prev.map((g) => (g.id === id ? before : g)));
    }
  };

  // ─── Azioni sui nodi del percorso ───────────────────
  const handlePathStart = async (goalId: string) => {
    await goalRepo.changeStatus(goalId, 'in_progress');
    refetch(true);
    onDataChanged?.();
  };
  const handlePathComplete = async (goalId: string) => {
    await goalRepo.changeStatus(goalId, 'completed');
    // Ricalcolo silenzioso: sblocca i nodi successivi (e la loro animazione)
    // senza far sparire l'albero dietro uno spinner.
    refetch(true);
    onDataChanged?.();
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
    setPathError(null);
    const res = await studentPathRepo.deactivate(selectedPathId, player.id);
    setDeactivating(false);
    if (res.error) {
      // La finestra resta aperta: il maestro deve poter riprovare senza
      // ricominciare, e soprattutto deve sapere che non e' successo niente
      // invece di crederci.
      setPathError(`Disattivazione non riuscita: ${res.error.message}`);
      return;
    }
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
    if (tab === 'obiettivi' || isGroup) {
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
      className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground mb-4 transition-colors group shrink-0"
    >
      <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
      {isGroup ? 'Torna ai gruppi' : 'Torna agli allievi'}
    </button>
  );

  // La composizione del gruppo vive sotto la testata: e' anagrafica, non
  // lavoro, quindi non merita una scheda tutta sua accanto a Obiettivi.
  const membersPanel = isGroup ? (
    <GroupMembersPanel group={player} editable={isCoach} />
  ) : null;

  /* ─── Testata ───────────────────────────────────────
     Le statistiche non stanno piu' in vista: quattro numeri grossi sotto il
     nome occupavano un terzo dello schermo del telefono per dati che si
     guardano una volta ogni tanto. Ora c'e' una freccina, e sopra la piega
     resta quello che serve sempre — chi e', a che livello, e le schede. */
  /** L'avatar della testata: 48 su telefono, 56 da desktop. */
  const avatarSize = isMobile ? 48 : 56;

  const heroStats: Array<{ value: string | number; label: string; color: string }> = isGroup
    ? [
        { value: activeGoals, label: 'Obiettivi aperti', color: 'var(--primary)' },
        { value: doneGoals, label: 'Conclusi', color: 'var(--success)' },
      ]
    : [
        { value: activeGoals, label: 'Obiettivi', color: 'var(--primary)' },
        { value: doneGoals, label: 'Conclusi', color: 'var(--success)' },
        { value: totalMatches, label: 'Match', color: 'var(--foreground)' },
        { value: `${winRate}%`, label: 'Win rate', color: 'var(--warning)' },
      ];

  const heroCard = (
    <>
      {/* Niente `layout` di motion su questa card: ha gia' la classe
          `animate-slide-up`, che e' un'animazione CSS di `transform`. Due
          sistemi che scrivono la stessa proprieta' sullo stesso nodo si
          annullano a vicenda e la testata entrava a scatti. L'apertura delle
          statistiche si anima da sola, qui sotto. */}
      <div className="card p-4 sm:p-5 mb-5 shrink-0 animate-slide-up">
        <div className="flex items-center gap-3.5">
          {/* L'avatar decide da solo la propria misura (stile in linea): il
              contenitore deve chiedere ESATTAMENTE quella, altrimenti la foto
              deborda e viene ritagliata. Prima il riquadro era 48px e la foto
              56: mancava un ottavo di faccia su ogni lato. */}
          {isGroup ? (
            <div
              className="flex items-center justify-center bg-primary-soft text-primary shrink-0"
              style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize * 0.28 }}
            >
              <Users size={avatarSize * 0.45} strokeWidth={2.2} />
            </div>
          ) : (
            <AvatarDisplay
              photoUrl={player.photo_url}
              fullName={player.full_name}
              size={avatarSize}
            />
          )}

          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] sm:text-[20px] font-bold tracking-[-0.025em] truncate">
              {player.full_name}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {isGroup ? (
                <Badge color="var(--cat-mente)" bg="var(--cat-mente-soft)">
                  Gruppo di lezione
                </Badge>
              ) : (
                <>
                  {ageCategory && (
                    <Badge color="var(--primary)" bg="var(--primary-soft)">
                      {ageCategory}
                    </Badge>
                  )}
                  {classified ? (
                    <Badge color="var(--success)" bg="var(--success-soft)">
                      FIT {displayRanking}
                    </Badge>
                  ) : (
                    <>
                      <Badge color="var(--warning)" bg="var(--warning-soft)">
                        {displayLevel}
                      </Badge>
                      <Badge>Non classificato</Badge>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {mode === 'self' && onEditProfile && (
              <IconButton
                label="Modifica profilo"
                onClick={onEditProfile}
                icon={<Pencil size={15} />}
              />
            )}
            {isCoach && player.is_fictitious && (
              <IconButton
                label={isGroup ? 'Elimina gruppo' : 'Elimina allievo gestito'}
                onClick={() => setDeleteDialogOpen(true)}
                icon={<Trash2 size={15} />}
                className="text-destructive hover:bg-destructive-soft hover:text-destructive"
              />
            )}
            <IconButton
              label={statsOpen ? 'Nascondi statistiche' : 'Mostra statistiche'}
              onClick={() => setStatsOpen((v) => !v)}
              aria-expanded={statsOpen}
              icon={
                <motion.span
                  animate={{ rotate: statsOpen ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 32 }}
                  className="flex"
                >
                  <ChevronDown size={17} />
                </motion.span>
              }
            />
          </div>
        </div>

        <AnimatePresence initial={false}>
          {statsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div
                className={`grid gap-2 mt-4 pt-4 border-t border-border-soft ${
                  isGroup ? 'grid-cols-2' : 'grid-cols-4'
                }`}
              >
                {heroStats.map((s) => (
                  <div key={s.label} className="text-center">
                    <p
                      className="text-[20px] sm:text-[22px] font-bold tracking-[-0.03em] tnum"
                      style={{ color: s.color }}
                    >
                      {typeof s.value === 'number' ? <AnimatedNumber value={s.value} /> : s.value}
                    </p>
                    <p className="text-[10px] font-semibold text-subtle-foreground uppercase tracking-[0.08em] mt-0.5">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {membersPanel}
    </>
  );

  const tabsBar = (
    <Tabs
      tabs={[
        { id: 'obiettivi', label: 'Obiettivi' },
        ...(PATHS_PREVIEW ? [{ id: 'percorso', label: 'Il mio percorso' }] : []),
        // I 12 passi si vedono solo se il maestro ha attivato un percorso per
        // questo allievo. Il maestro la scheda ce l'ha sempre: e' da li' che
        // attiva, cambia o disattiva.
        ...(KIDS_PATHS && (kidsLevel !== null || isCoach)
          ? [{ id: 'kids', label: '12 passi' }]
          : []),
        // I match sono individuali: un gruppo non scende in campo.
        ...(isGroup ? [] : [{ id: 'match', label: 'Match' }]),
      ]}
      active={tab}
      onChange={(v) => setTab(v as PlayerTab)}
    />
  );

  // Percorsi Kids: i 12 passi del Diario del Tennis. Il percorso attivo lo
  // decide il maestro (profiles.kids_path_level, NULL = nessuno). Il
  // componente gestisce da solo caricamento, spunte, attivazione e passaggio
  // di livello; qui ci limitiamo a propagare il refresh.
  const kidsContent = (
    <KidsPathSection
      student={player}
      actorId={writerId}
      isCoach={isCoach}
      onLevelChanged={(nuovoLivello) => {
        // PRIMA il livello locale: e' la dipendenza dell'effetto che ricarica
        // obiettivi e match, quindi settarlo fa ripartire la lettura con il
        // percorso giusto (o con nessun percorso, dopo una disattivazione).
        // Senza, la lista resterebbe quella di prima e la sincronizzazione
        // ricreerebbe le card appena cancellate.
        setKidsLevel(nuovoLivello);
        onDataChanged?.();
      }}
      onObjectivesChanged={({ keys, done, listaCambiata }) => {
        // Se si sono aperte o richiuse pagine del libretto sono nate o sparite
        // delle card: la lista va riletta per intero, un ritocco non basta.
        //
        // SILENZIOSA, e non e' un dettaglio: lo spinner qui sopra sostituisce
        // il contenuto della scheda, quindi accenderlo SMONTA KidsPathSection.
        // Al rimontaggio quel componente riparte dal suo stato iniziale, che
        // e' la vista 'elenco' — ed e' per questo che completare un passo
        // rispediva alla scelta del percorso. La rilettura serve, ma deve
        // avvenire sotto: a schermo la mappa e' gia' giusta per via
        // dell'aggiornamento ottimistico delle spunte.
        if (listaCambiata) {
          refetch(true);
          return;
        }

        // Caso normale. Sul database la card e' GIA' nello stato giusto — ci
        // hanno pensato i trigger — quindi qui non si scrive niente: si
        // rispecchia soltanto quel valore nella copia in memoria, com'e' gia'
        // fatto per il cambio di stato e di progresso dal Kanban. Costa zero
        // richieste e la card si sposta immediatamente.
        const toccati = new Set(keys);
        const completedAt = done ? new Date().toISOString() : null;
        setGoals((prev) =>
          prev.map((g) =>
            g.kids_objective_key && toccati.has(g.kids_objective_key)
              ? {
                  ...g,
                  status: done ? 'completed' : 'planned',
                  progress: done ? 100 : 0,
                  completed_at: completedAt,
                }
              : g
          )
        );
      }}
    />
  );

  const addMatchButton = (
    <div className="hidden sm:flex justify-end">
      <Button
        icon={<Plus size={15} strokeWidth={2.6} />}
        onClick={() => {
          setEditingMatch(null);
          setMatchFormOpen(true);
        }}
      >
        Aggiungi match
      </Button>
    </div>
  );

  // Va DENTRO la bacheca, in fondo alla riga dei filtri (vedi il prop
  // `toolbarAction` di KanbanBoard). Prima stava qui sopra, in una riga tutta
  // sua allineata a destra, e il menu delle categorie restava spaiato sotto a
  // sinistra: due comandi della stessa barra su due piani diversi.
  const newGoalButton = (
    <Button
      icon={<Plus size={15} strokeWidth={2.6} />}
      onClick={() => {
        setEditingGoal(null);
        setGoalFormOpen(true);
      }}
    >
      Nuovo obiettivo
    </Button>
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
        toolbarAction={newGoalButton}
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
      {pathError && (
        <p className="shrink-0 text-[12px] font-semibold text-destructive mb-3">{pathError}</p>
      )}
      {activePaths.length > 1 && (
        <div className="shrink-0 flex gap-2 mb-3 overflow-x-auto scrollbar-hidden">
          {activePaths.map((ap) => (
            <button
              key={ap.path.id}
              onClick={() => setSelectedPathId(ap.path.id)}
              className={`shrink-0 px-3 py-1.5 rounded-[var(--radius-md)] text-[12px] font-semibold border transition-colors ${
                selectedPathId === ap.path.id
                  ? 'bg-primary text-[var(--primary-foreground)] border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-[var(--border-strong)]'
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
    // `overflow-hidden` qui ritaglia al PROPRIO padding box. Se questa radice
    // resta rientrata del gutter di pagina, ritaglia tutto quello che prova a
    // uscirne — mappa dei 12 passi compresa, per quanto in basso stia. Quindi
    // la radice va da bordo a bordo e si rimette il respiro come padding:
    // adesso ritaglia sul viewport, cioe' non ritaglia niente.
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden full-bleed page-gutter-x">
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
        ) : tab === 'kids' ? (
          // Il contenitore di scorrimento va da bordo a bordo e si rimette il
          // respiro laterale come PADDING, non come margine della pagina.
          //
          // Serve perche' `overflow-y: auto` fa calcolare anche `overflow-x`
          // ad `auto`: questo div diventa un contenitore di scorrimento e
          // RITAGLIA sul proprio padding box. Finche' quel padding box era
          // rientrato dei 16px del gutter, la mappa dei 12 passi non poteva in
          // alcun modo raggiungere i bordi dello schermo e restavano due
          // strisce bianche ai lati. Cosi' invece il padding box coincide con
          // il viewport e `.full-bleed` (dentro KidsPathMap) ci arriva esatto,
          // senza overflow.
          //
          // E NIENTE `pb-*`: le altre tab lo mettono perche' finiscono con
          // delle card, che sul fondo hanno bisogno di respiro. Qui l'ultima
          // cosa e' la mappa a tutto schermo, che il respiro se lo porta gia'
          // dentro (la fascia del traguardo, vedi Geo.finish). Aggiungerne
          // altro fuori voleva dire una striscia di sfondo pagina sotto al
          // fondale del percorso: sembrava un ritaglio sbagliato, non un
          // margine.
          <div className="flex-1 min-h-0 overflow-y-auto full-bleed page-gutter-x">
            {kidsContent}
          </div>
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
  ) : tab === 'kids' ? (
    <>
      {backLink}
      {heroCard}
      {tabsBar}
      <div className="mt-5">{kidsContent}</div>
    </>
  ) : (
    <>
      {backLink}
      {heroCard}
      {tabsBar}
      <div className="mt-5">
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

      {tab !== 'percorso' && tab !== 'kids' && (
        <motion.button
          onClick={handleFab}
          whileTap={{ scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 620, damping: 26 }}
          className="sm:hidden fab"
          aria-label={tab === 'obiettivi' ? 'Nuovo obiettivo' : 'Aggiungi match'}
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        >
          <Plus size={22} strokeWidth={2.6} />
        </motion.button>
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
