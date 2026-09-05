'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, CircleCheckBig, Trophy, UserPlus, UserCog } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { profileRepo, goalRepo, matchRepo, groupRepo } from '@/lib/repositories';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Tabs, SectionSwitcher, SearchBar, Spinner, Badge, EmptyState, ConfirmDialog, Button } from '@/components/UI';
import type { Profile, MatchResultRow } from '@/lib/database.types';
import { getDisplayRanking, getAgeCategory, isClassified } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { MatchCard } from '@/components/MatchCard';
import { CoachNotesForm } from '@/components/CoachNotesForm';
import { CoachMobileDashboard } from './CoachMobileDashboard';
import { PendingCard } from './components/PendingCard';
import { CreateStudentForm } from './components/CreateStudentForm';
import { CreateGroupForm } from './components/CreateGroupForm';
import { GroupRow } from './components/GroupRow';
import { PlayerView } from '../student/PlayerView';
import { PathManager } from '@/components/PathManager';
import { KidsPathCatalog } from '@/components/kids/KidsPathCatalog';
import { KIDS_PATHS } from '@/lib/constants';
import { KIDS_PROGRAMS } from '@/lib/kids/curriculum';
import {
  useGoalTemplates,
  GoalTemplatesHeader,
  GoalTemplatesList,
} from '@/components/GoalTemplateManager';

export function CoachDashboard() {
  return (
    <>
      <div className="sm:hidden">
        <CoachMobileDashboard />
      </div>
      <div className="hidden sm:block">
        <CoachDesktopDashboard />
      </div>
    </>
  );
}

interface ClubStats {
  studentsTotal: number;
  studentsMonth: number;
  goalsTotal: number;
  goalsMonth: number;
  matchesTotal: number;
  matchesMonth: number;
  winRate: number;
  winRateDelta: number;
}

function CoachDesktopDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'allievi' | 'gruppi' | 'catalogo' | 'risultati' | 'richieste'>('allievi');
  const [catalogView, setCatalogView] = useState<'obiettivi' | 'percorsi' | 'kids'>('obiettivi');
  const [students, setStudents] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<Profile[]>([]);
  const [groupMembers, setGroupMembers] = useState<Record<string, number>>({});
  const [groupGoals, setGroupGoals] = useState<Record<string, number>>({});
  const [pendingProfiles, setPendingProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);

  const [allMatches, setAllMatches] = useState<MatchResultRow[]>([]);
  const [allMatchesLoading, setAllMatchesLoading] = useState(false);

  const [clubStats, setClubStats] = useState<ClubStats | null>(null);

  const [coachNotesOpen, setCoachNotesOpen] = useState(false);
  const [coachNotesMatch, setCoachNotesMatch] = useState<MatchResultRow | null>(null);

  const [confirmReject, setConfirmReject] = useState<Profile | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);

  const [reloadTick, setReloadTick] = useState(0);
  const refresh = useCallback(() => setReloadTick((t) => t + 1), []);

  const catalogCtx = useGoalTemplates(user?.id ?? '');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthStartIso = monthStart.toISOString();
      const monthStartDay = monthStartIso.slice(0, 10);
      const prevMonthStartDay = prevMonthStart.toISOString().slice(0, 10);

      const [s, p, goalsRes, matchesRes, groupsRes] = await Promise.all([
        profileRepo.listApprovedStudents(),
        profileRepo.listPendingStudents(),
        goalRepo.listAllForStats(),
        matchRepo.listAllForStats(),
        groupRepo.list(),
      ]);
      if (cancelled) return;

      // I gruppi di lezione sono profili con `is_group = true`: le liste
      // allievi li escludono, qui li carichiamo a parte (ADR-5-1).
      const groupList = groupsRes.data ?? [];
      const groupIds = groupList.map((g) => g.id);
      const [membersRes, groupGoalsRes] = await Promise.all([
        groupRepo.countMembers(groupIds),
        groupIds.length > 0
          ? supabase.from('goals').select('student_id, status').in('student_id', groupIds)
          : Promise.resolve({ data: [] as { student_id: string; status: string }[] }),
      ]);
      if (cancelled) return;

      const gGoals: Record<string, number> = {};
      for (const id of groupIds) gGoals[id] = 0;
      for (const row of (groupGoalsRes.data ?? []) as { student_id: string; status: string }[]) {
        if (row.status !== 'completed') gGoals[row.student_id] = (gGoals[row.student_id] ?? 0) + 1;
      }

      const studentList = s.data ?? [];
      const goals = goalsRes.data ?? [];
      const matches = matchesRes.data ?? [];

      const studentsMonth = studentList.filter((st) => st.created_at >= monthStartIso).length;
      const goalsMonth = goals.filter((g) => g.created_at >= monthStartIso).length;
      const matchesThisMonth = matches.filter((m) => m.match_date >= monthStartDay);
      const matchesPrevMonth = matches.filter((m) => m.match_date >= prevMonthStartDay && m.match_date < monthStartDay);
      const totalWins = matches.filter((m) => m.result === 'win').length;
      const winRate = matches.length > 0 ? Math.round((totalWins / matches.length) * 100) : 0;
      const wrThis = matchesThisMonth.length > 0
        ? Math.round((matchesThisMonth.filter((m) => m.result === 'win').length / matchesThisMonth.length) * 100)
        : winRate;
      const wrPrev = matchesPrevMonth.length > 0
        ? Math.round((matchesPrevMonth.filter((m) => m.result === 'win').length / matchesPrevMonth.length) * 100)
        : wrThis;

      setStudents(studentList);
      setGroups(groupList);
      setGroupMembers(membersRes.data ?? {});
      setGroupGoals(gGoals);
      setPendingProfiles(p.data ?? []);
      setClubStats({
        studentsTotal: studentList.length,
        studentsMonth,
        goalsTotal: goals.length,
        goalsMonth,
        matchesTotal: matches.length,
        matchesMonth: matchesThisMonth.length,
        winRate,
        winRateDelta: wrThis - wrPrev,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  // L'allievo aperto e' una COPIA presa dall'elenco al momento del clic: da
  // quel punto in poi non lo tocca piu' nessuno. Ogni volta che l'elenco
  // viene riletto va quindi risincronizzato, altrimenti la sua scheda
  // continua a ragionare su un profilo vecchio.
  //
  // E' il difetto che si vedeva sull'attivazione dei percorsi Kids: il
  // maestro attivava o disattivava un percorso, tornava all'elenco e
  // rientrava, e si ritrovava davanti lo stato di prima — perche' il profilo
  // che gli veniva ripassato era ancora quello caricato all'apertura. Al
  // secondo tentativo "funzionava", cioe' la scrittura era andata a buon fine
  // fin dalla prima volta ma non si vedeva.
  //
  // Se l'allievo sparisce dall'elenco (rifiutato, disattivato) si tiene
  // quello che c'e': chiudergli la scheda sotto le mani sarebbe peggio.
  useEffect(() => {
    if (!selectedStudent) return;
    const fresco =
      students.find((s) => s.id === selectedStudent.id) ??
      groups.find((g) => g.id === selectedStudent.id);
    if (fresco && fresco !== selectedStudent) setSelectedStudent(fresco);
  }, [students, groups, selectedStudent]);

  useEffect(() => {
    if (activeTab !== 'risultati') return;
    let cancelled = false;
    (async () => {
      setAllMatchesLoading(true);
      const res = await matchRepo.listAllWithStudent(100);
      if (!cancelled) {
        setAllMatches(res.data ?? []);
        setAllMatchesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, reloadTick]);

  const filteredStudents = students.filter((s) =>
    `${s.full_name} ${s.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGroups = groups.filter((g) =>
    g.full_name.toLowerCase().includes(search.toLowerCase())
  );

  // Approve / Reject
  const handleApprove = async (p: Profile) => {
    setActingOn(p.id);
    await profileRepo.setApprovalStatus(p.id, 'approved', user?.id ?? null);
    refresh();
    setActingOn(null);
  };

  const handleReject = async (p: Profile) => {
    setActingOn(p.id);
    await profileRepo.setApprovalStatus(p.id, 'rejected', user?.id ?? null);
    refresh();
    setConfirmReject(null);
    setActingOn(null);
  };

  // Match coach-notes from Risultati tab
  const handleSaveCoachNotes = async (notes: string) => {
    if (coachNotesMatch) {
      await matchRepo.setCoachNotes(coachNotesMatch.id, notes || null);
      refresh();
    }
  };

  const handleDeleteMatch = async (id: string) => {
    await matchRepo.delete(id);
    refresh();
  };

  // Student detail (uses shared PlayerView)
  if (selectedStudent) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <Header />
        <main className="w-full max-w-7xl mx-auto page-gutter-x pb-6">
          <PlayerView
            player={selectedStudent}
            mode="coach"
            writerId={user?.id ?? ''}
            onBack={() => {
              setSelectedStudent(null);
              refresh();
            }}
            onDataChanged={refresh}
          />
        </main>
      </div>
    );
  }

  // Main view
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header />
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="sticky top-16 z-30 bg-[var(--background)] -mx-4 sm:-mx-6 px-4 sm:px-6 pt-6 pb-3">
          <ClubOverview stats={clubStats} />

          <Tabs
            tabs={[
              { id: 'allievi', label: `Allievi (${students.length})` },
              { id: 'gruppi', label: `Gruppi (${groups.length})` },
              { id: 'catalogo', label: 'Catalogo' },
              { id: 'risultati', label: 'Risultati Agonistici' },
              { id: 'richieste', label: `Richieste${pendingProfiles.length > 0 ? ` · ${pendingProfiles.length}` : ''}` },
            ]}
            active={activeTab}
            onChange={(t) => {
              setActiveTab(t as typeof activeTab);
              // La barra di ricerca e' condivisa fra Allievi e Gruppi: senza
              // azzerarla, cambiando scheda si vedrebbe un falso "nessun
              // risultato" dovuto alla query precedente.
              setSearch('');
            }}
          />

          {activeTab === 'allievi' && (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <SearchBar value={search} onChange={setSearch} placeholder="Cerca allievo per nome o email..." />
              </div>
              <Button variant="secondary" onClick={() => setCreateOpen(true)} className="shrink-0">
                <UserPlus size={16} strokeWidth={2.2} />
                Aggiungi allievo
              </Button>
            </div>
          )}

          {activeTab === 'gruppi' && (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <SearchBar value={search} onChange={setSearch} placeholder="Cerca gruppo per nome..." />
              </div>
              <Button variant="primary" onClick={() => setCreateGroupOpen(true)} className="shrink-0">
                <Users size={16} strokeWidth={2.2} />
                Nuovo gruppo
              </Button>
            </div>
          )}

          {activeTab === 'catalogo' && (
            <div className="mt-4 flex flex-col gap-3">
              {/* `max-w-md`: a tutta larghezza qui vorrebbe dire tre segmenti
                  da quattrocento punti l'uno, che non e' risalto ma sciatteria.
                  Su telefono lo stesso selettore riempie invece lo schermo. */}
              <SectionSwitcher
                className="max-w-md"
                tabs={(KIDS_PATHS
                  ? (['obiettivi', 'percorsi', 'kids'] as const)
                  : (['obiettivi', 'percorsi'] as const)
                ).map((v) => ({
                  id: v,
                  label:
                    v === 'obiettivi' ? 'Obiettivi' : v === 'percorsi' ? 'Percorsi' : 'Percorsi Kids',
                  color: v === 'kids' ? KIDS_PROGRAMS.DELFINO.colors.accent : 'var(--primary)',
                }))}
                active={catalogView}
                onChange={(v) => setCatalogView(v as typeof catalogView)}
              />
              {catalogView === 'obiettivi' && (
                <GoalTemplatesHeader ctx={catalogCtx} isMobile={false} />
              )}
            </div>
          )}

          {activeTab === 'richieste' && (
            <div className="mt-4 card p-4 flex items-start gap-3 bg-[var(--primary-soft)] border-[var(--primary-border)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5 text-[var(--primary)]">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-[var(--club-blue)]">Approvazioni allievi</p>
                <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed mt-0.5">
                  Gli allievi si registrano in autonomia e attendono qui la tua approvazione. Una volta approvati potranno accedere alla loro dashboard.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5">
          {activeTab === 'allievi' && (
            <>
              {loading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : filteredStudents.length === 0 ? (
                <EmptyState
                  icon={<Users size={40} strokeWidth={1.5} />}
                  title="Nessun allievo"
                  message={search ? 'Nessun risultato per la ricerca.' : 'Non ci sono ancora allievi approvati. Le richieste di registrazione le trovi nella tab "Richieste".'}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
                  {filteredStudents.map((student) => (
                    <StudentCard key={student.id} student={student} onClick={() => setSelectedStudent(student)} />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'gruppi' && (
            <>
              {loading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : filteredGroups.length === 0 ? (
                <EmptyState
                  icon={<Users size={40} strokeWidth={1.5} />}
                  title="Nessun gruppo"
                  message={search
                    ? 'Nessun risultato per la ricerca.'
                    : 'Crea un gruppo per le tue ore di lezione: potrai assegnargli obiettivi e percorsi esattamente come a un allievo.'}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
                  {filteredGroups.map((g) => (
                    <GroupRow
                      key={g.id}
                      group={g}
                      members={groupMembers[g.id] ?? 0}
                      openGoals={groupGoals[g.id] ?? 0}
                      onClick={() => setSelectedStudent(g)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'catalogo' && (
            catalogView === 'obiettivi' ? (
              <GoalTemplatesList ctx={catalogCtx} isMobile={false} />
            ) : catalogView === 'percorsi' ? (
              <div className="h-[70vh]">
                <PathManager coachId={user?.id ?? ''} />
              </div>
            ) : (
              <div className="h-[70vh]">
                <KidsPathCatalog onOpenStudent={setSelectedStudent} />
              </div>
            )
          )}

          {activeTab === 'risultati' && (
            <>
              {allMatchesLoading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : allMatches.length === 0 ? (
                <EmptyState icon={<Trophy size={40} strokeWidth={1.5} />} title="Nessun risultato" message="Gli allievi non hanno ancora registrato match." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
                  {allMatches.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      showStudentName={true}
                      isCoach={true}
                      onEdit={(mm) => {
                        const stu = students.find((s) => s.id === mm.student_id);
                        if (stu) setSelectedStudent(stu);
                      }}
                      onDelete={handleDeleteMatch}
                      onEditCoachNotes={(mm) => { setCoachNotesMatch(mm); setCoachNotesOpen(true); }}
                    />
                  ))}
                </div>
              )}
              <CoachNotesForm
                open={coachNotesOpen}
                onClose={() => { setCoachNotesOpen(false); setCoachNotesMatch(null); }}
                onSave={handleSaveCoachNotes}
                currentNotes={coachNotesMatch?.coach_notes}
              />
            </>
          )}

          {activeTab === 'richieste' && (
            <>
              {loading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : pendingProfiles.length === 0 ? (
                <EmptyState icon={<CircleCheckBig size={40} strokeWidth={1.5} />} title="Tutto in ordine" message="Nessuna richiesta di registrazione in attesa." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 stagger-children">
                  {pendingProfiles.map((p) => (
                    <PendingCard
                      key={p.id}
                      profile={p}
                      busy={actingOn === p.id}
                      onApprove={() => handleApprove(p)}
                      onReject={() => setConfirmReject(p)}
                      variant="desktop"
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={!!confirmReject}
        title="Rifiutare la registrazione?"
        message={confirmReject ? `Sei sicuro di voler rifiutare la registrazione di ${confirmReject.full_name}? L'utente non potrà accedere.` : ''}
        confirmLabel="Rifiuta"
        onConfirm={() => confirmReject && handleReject(confirmReject)}
        onCancel={() => setConfirmReject(null)}
      />

      <CreateStudentForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => refresh()}
      />

      <CreateGroupForm
        open={createGroupOpen}
        coachId={user?.id ?? null}
        onClose={() => setCreateGroupOpen(false)}
        onCreated={() => refresh()}
      />
    </div>
  );
}

// Desktop StudentCard (in the Allievi list)
function StudentCard({ student, onClick }: { student: Profile; onClick: () => void }) {
  const [stats, setStats] = useState({ goals: 0, completed: 0, matches: 0, wins: 0 });
  const { displayLevel, displayRanking } = getDisplayRanking(student);
  const cardClassified = isClassified(displayRanking);
  const cardAgeCategory = getAgeCategory(student.birth_date);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Per-card stats: fetched in parallel. The 'count' queries are
      // server-aggregated (head:true) so they don't transfer rows.
      const [{ count: goalsCount }, { count: completedCount }, { data: matchData }] = await Promise.all([
        supabase.from('goals').select('*', { count: 'exact', head: true }).eq('student_id', student.id),
        supabase.from('goals').select('*', { count: 'exact', head: true }).eq('student_id', student.id).eq('status', 'completed'),
        supabase.from('match_results').select('result').eq('student_id', student.id),
      ]);
      if (!cancelled) {
        const wins = (matchData || []).filter((m: { result: string }) => m.result === 'win').length;
        setStats({
          goals: goalsCount || 0,
          completed: completedCount || 0,
          matches: (matchData || []).length,
          wins,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [student.id]);

  return (
    <div onClick={onClick} className="card card-interactive p-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--club-blue)] to-[var(--club-blue-dark)] flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
          {student.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-sm font-bold text-[var(--foreground)] truncate tracking-[-0.01em]">{student.full_name}</h3>
            {student.is_fictitious && (
              <UserCog
                size={13}
                strokeWidth={2.2}
                className="shrink-0 text-[var(--club-blue)]/70"
                aria-label="Account gestito dal maestro"
              >
                <title>Account gestito dal maestro</title>
              </UserCog>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {cardAgeCategory && <Badge color="var(--club-blue)" bg="var(--club-blue-light)">{cardAgeCategory}</Badge>}
            {!cardClassified && <Badge>{displayLevel}</Badge>}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--border-strong)]">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      <div className="flex items-center gap-1.5 mb-3 pl-0.5">
        <span className="text-[11px] text-[var(--subtle-foreground)] font-medium">Classifica FIT:</span>
        <span className="text-[11px] font-bold text-[var(--club-red)]">{cardClassified ? displayRanking : 'Non classificato'}</span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center pt-3 border-t border-[var(--border-soft)]">
        <div>
          <p className="tnum text-sm font-bold text-[var(--primary)]">{stats.goals}</p>
          <p className="text-[10px] font-semibold text-[var(--subtle-foreground)] uppercase tracking-wider">Obiettivi</p>
        </div>
        <div>
          <p className="tnum text-sm font-bold text-[var(--cat-agonismo)]">{stats.completed}</p>
          <p className="text-[10px] font-semibold text-[var(--subtle-foreground)] uppercase tracking-wider">Completati</p>
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--foreground)]">{stats.matches}</p>
          <p className="text-[10px] font-semibold text-[var(--subtle-foreground)] uppercase tracking-wider">Match</p>
        </div>
        <div>
          <p className="tnum text-sm font-bold text-[var(--success)]">{stats.wins}</p>
          <p className="text-[10px] font-semibold text-[var(--subtle-foreground)] uppercase tracking-wider">Vittorie</p>
        </div>
      </div>
    </div>
  );
}

// Club Overview Panel
const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

/* ═════════════════════════════════════════════════════════════════════════
   Panoramica del club.

   Era un pannello blu notte con un gradiente e quattro pastelli (viola, rosa,
   ciano, giallo) scritti a mano: restava scuro anche a tema chiaro, quindi
   galleggiava sopra la pagina come un pezzo di un'altra applicazione, e a
   tema scuro spariva dentro il fondo.

   Ora e' una card come tutte le altre e i suoi colori escono dalla palette,
   quindi segue il tema da sola. E' anche lo stesso linguaggio del riepilogo
   sul telefono — pastiglia dell'icona, numero grande, etichetta maiuscoletta
   — cosi' le due schermate si leggono allo stesso modo.
   ═════════════════════════════════════════════════════════════════════════ */

function ClubOverview({ stats }: { stats: ClubStats | null }) {
  const now = new Date();
  const monthLabel = `${IT_MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const voci = [
    {
      icon: <UsersIcon />,
      accent: 'var(--primary)',
      label: 'Allievi attivi',
      value: stats ? String(stats.studentsTotal) : '—',
      delta: stats ? formatDelta(stats.studentsMonth) : '',
    },
    {
      icon: <TargetIcon />,
      accent: 'var(--cat-agonismo)',
      label: 'Obiettivi totali',
      value: stats ? String(stats.goalsTotal) : '—',
      delta: stats ? formatDelta(stats.goalsMonth) : '',
    },
    {
      icon: <RacketIcon />,
      accent: 'var(--info)',
      label: 'Match totali',
      value: stats ? String(stats.matchesTotal) : '—',
      delta: stats ? formatDelta(stats.matchesMonth) : '',
    },
    {
      icon: <TrophyIcon />,
      accent: 'var(--success)',
      label: 'Win rate generale',
      value: stats ? `${stats.winRate}%` : '—',
      delta: stats ? formatDelta(stats.winRateDelta, '%') : '',
    },
  ];

  return (
    <div className="card mb-6 overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--subtle-foreground)]">
            Panoramica club
          </p>
          <p className="mt-1 text-[12.5px] text-[var(--muted-foreground)]">
            Dati aggregati · {monthLabel}
          </p>
        </div>
      </div>

      {/* I separatori sono sui figli, non `divide-x`: cosi' la riga puo'
          andare a capo sotto i 1024px senza lasciare un filetto sospeso. */}
      <div className="grid grid-cols-2 border-t border-[var(--border-soft)] lg:grid-cols-4">
        {voci.map((v, i) => (
          <OverviewStat
            key={v.label}
            {...v}
            className={cn(
              i % 2 === 1 && 'border-l border-[var(--border-soft)]',
              i >= 2 && 'border-t border-[var(--border-soft)]',
              'lg:border-t-0',
              i > 0 && 'lg:border-l'
            )}
          />
        ))}
      </div>
    </div>
  );
}

function formatDelta(n: number, suffix = '') {
  if (n === 0) return `± 0${suffix} questo mese`;
  const sign = n > 0 ? '↑ +' : '↓ ';
  return `${sign}${n}${suffix} questo mese`;
}

function OverviewStat({
  icon, accent, label, value, delta, className,
}: {
  icon: React.ReactNode;
  accent: string;
  label: string;
  value: string;
  delta: string;
  className?: string;
}) {
  const isPositive = delta.startsWith('↑');
  const isNeutral = delta.startsWith('±');
  return (
    <div className={cn('px-6 py-5', className)}>
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
          style={{
            background: `color-mix(in srgb, ${accent} 12%, transparent)`,
            color: accent,
          }}
          aria-hidden
        >
          {icon}
        </span>
        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--subtle-foreground)]">
          {label}
        </span>
      </div>
      <p className="tnum mb-1.5 text-[32px] font-bold leading-none tracking-[-0.03em] text-[var(--foreground)]">
        {value}
      </p>
      <p
        className="text-[12px] font-medium"
        style={{
          color: isPositive
            ? 'var(--success)'
            : isNeutral
              ? 'var(--subtle-foreground)'
              : 'var(--destructive)',
        }}
      >
        {delta}
      </p>
    </div>
  );
}

function UsersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function RacketIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="6" />
      <path d="m13.5 13.5 7 7" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
