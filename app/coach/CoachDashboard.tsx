'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button, Tabs, SearchBar, Spinner, Badge, EmptyState, Modal, Input } from '@/components/UI';
import type { Profile, Goal, MatchResultRow, GoalStatus } from '@/lib/database.types';
import { getDisplayRanking } from '@/lib/constants';
import { KanbanBoard } from '@/components/KanbanBoard';
import { GoalForm } from '@/components/GoalForm';
import { MatchCard } from '@/components/MatchCard';
import { MatchForm } from '@/components/MatchForm';
import { CoachNotesForm } from '@/components/CoachNotesForm';

export function CoachDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('allievi');
  const [students, setStudents] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ token?: string; error?: string } | null>(null);

  // Student detail state
  const [studentTab, setStudentTab] = useState('obiettivi');
  const [studentGoals, setStudentGoals] = useState<Goal[]>([]);
  const [studentMatches, setStudentMatches] = useState<MatchResultRow[]>([]);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [matchFormOpen, setMatchFormOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<MatchResultRow | null>(null);
  const [coachNotesOpen, setCoachNotesOpen] = useState(false);
  const [coachNotesMatch, setCoachNotesMatch] = useState<MatchResultRow | null>(null);

  // All matches for "Risultati Agonistici" tab
  const [allMatches, setAllMatches] = useState<MatchResultRow[]>([]);
  const [allMatchesLoading, setAllMatchesLoading] = useState(false);

  // ─── Data fetching via effects (React 19 compliant) ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'allievo')
        .eq('active', true)
        .order('full_name');
      if (!cancelled) {
        setStudents((data as Profile[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (activeTab !== 'risultati') return;
    let cancelled = false;
    (async () => {
      setAllMatchesLoading(true);
      const { data } = await supabase
        .from('match_results')
        .select('*, profiles!match_results_student_id_fkey(full_name)')
        .order('match_date', { ascending: false })
        .limit(100);
      if (!cancelled) {
        setAllMatches((data as MatchResultRow[]) || []);
        setAllMatchesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab]);

  useEffect(() => {
    if (!selectedStudent) return;
    let cancelled = false;
    (async () => {
      const [{ data: goals }, { data: matches }] = await Promise.all([
        supabase.from('goals').select('*').eq('student_id', selectedStudent.id).order('sort_order'),
        supabase.from('match_results').select('*').eq('student_id', selectedStudent.id).order('match_date', { ascending: false }),
      ]);
      if (!cancelled) {
        setStudentGoals((goals as Goal[]) || []);
        setStudentMatches((matches as MatchResultRow[]) || []);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedStudent]);

  // ─── Refetch helpers for event handlers ───
  const refetchStudents = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'allievo').eq('active', true).order('full_name');
    setStudents((data as Profile[]) || []);
  };

  const refetchAllMatches = async () => {
    const { data } = await supabase.from('match_results').select('*, profiles!match_results_student_id_fkey(full_name)').order('match_date', { ascending: false }).limit(100);
    setAllMatches((data as MatchResultRow[]) || []);
  };

  const refetchStudentData = async (studentId: string) => {
    const [{ data: goals }, { data: matches }] = await Promise.all([
      supabase.from('goals').select('*').eq('student_id', studentId).order('sort_order'),
      supabase.from('match_results').select('*').eq('student_id', studentId).order('match_date', { ascending: false }),
    ]);
    setStudentGoals((goals as Goal[]) || []);
    setStudentMatches((matches as MatchResultRow[]) || []);
  };

  const filteredStudents = students.filter((s) =>
    `${s.full_name} ${s.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const goalStats = () => {
    const g = studentGoals;
    return { total: g.length, completed: g.filter((x) => x.status === 'completed').length };
  };

  const matchStats = (matches: MatchResultRow[]) => {
    const wins = matches.filter((m) => m.result === 'win').length;
    return { total: matches.length, wins, losses: matches.length - wins };
  };

  // ─── Invite ────────────────────────────────────────
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteResult(null);

    const { data, error } = await supabase.from('invite_links').insert({
      email: inviteEmail.trim(),
      role: 'allievo',
      invited_by: user?.id,
    }).select().single();

    if (error) {
      setInviteResult({ error: error.message });
    } else if (data) {
      const link = `${window.location.origin}?invite=${data.token}`;
      setInviteResult({ token: link });
    }
    setInviteLoading(false);
  };

  // ─── Goal CRUD ─────────────────────────────────────
  const handleSaveGoal = async (data: Partial<Goal>) => {
    if (editingGoal) {
      await supabase.from('goals').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingGoal.id);
    } else {
      await supabase.from('goals').insert({ ...data, student_id: selectedStudent!.id, created_by: user?.id });
    }
    await refetchStudentData(selectedStudent!.id);
    setEditingGoal(null);
  };

  const handleDeleteGoal = async (id: string) => {
    await supabase.from('goals').delete().eq('id', id);
    await refetchStudentData(selectedStudent!.id);
  };

  const handleGoalStatusChange = async (id: string, status: GoalStatus) => {
    const updates: Partial<Goal> = { status, updated_at: new Date().toISOString() };
    if (status === 'completed') { updates.progress = 100; updates.completed_at = new Date().toISOString(); }
    if (status === 'planned') { updates.progress = 0; updates.completed_at = null; }
    await supabase.from('goals').update(updates).eq('id', id);
    await refetchStudentData(selectedStudent!.id);
  };

  const handleGoalProgressChange = async (id: string, progress: number) => {
    await supabase.from('goals').update({ progress, updated_at: new Date().toISOString() }).eq('id', id);
    setStudentGoals((prev) => prev.map((g) => g.id === id ? { ...g, progress } : g));
  };

  // ─── Match CRUD ────────────────────────────────────
  const handleSaveMatch = async (data: Partial<MatchResultRow>) => {
    if (editingMatch) {
      await supabase.from('match_results').update(data).eq('id', editingMatch.id);
    } else {
      await supabase.from('match_results').insert({ ...data, student_id: selectedStudent!.id });
    }
    await refetchStudentData(selectedStudent!.id);
    setEditingMatch(null);
  };

  const handleDeleteMatch = async (id: string) => {
    await supabase.from('match_results').delete().eq('id', id);
    if (selectedStudent) await refetchStudentData(selectedStudent.id);
    if (activeTab === 'risultati') await refetchAllMatches();
  };

  const handleSaveCoachNotes = async (notes: string) => {
    if (coachNotesMatch) {
      await supabase.from('match_results').update({ coach_notes: notes || null }).eq('id', coachNotesMatch.id);
      if (selectedStudent) await refetchStudentData(selectedStudent.id);
      if (activeTab === 'risultati') await refetchAllMatches();
    }
  };

  // ─── FAB handler for student detail view ───────────
  const handleStudentFabClick = () => {
    if (studentTab === 'obiettivi') {
      setEditingGoal(null);
      setGoalFormOpen(true);
    } else {
      setEditingMatch(null);
      setMatchFormOpen(true);
    }
  };

  // ─── Student detail view ───────────────────────────
  if (selectedStudent) {
    const ms = matchStats(studentMatches);
    const gs = goalStats();
    const { displayLevel, displayRanking } = getDisplayRanking(selectedStudent);

    return (
      <div className="min-h-screen bg-[var(--background)]">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-6">
          {/* Back button */}
          <button
            onClick={() => setSelectedStudent(null)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            Torna alla lista
          </button>

          {/* Student header */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[var(--club-blue)] flex items-center justify-center text-white text-xl font-bold">
                {selectedStudent.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{selectedStudent.full_name}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge>{displayLevel}</Badge>
                  <Badge color="var(--club-red)" bg="var(--club-red-light)">
                    Classifica FIT: {displayRanking}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-center">
                <div className="px-3">
                  <p className="text-lg font-bold text-[var(--club-blue)]">{gs.total}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Obiettivi</p>
                </div>
                <div className="px-3">
                  <p className="text-lg font-bold text-green-600">{gs.completed}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Completati</p>
                </div>
                <div className="px-3">
                  <p className="text-lg font-bold text-gray-700">{ms.total}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Match</p>
                </div>
                <div className="px-3">
                  <p className="text-lg font-bold text-[var(--club-red)]">{ms.wins}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Vittorie</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            tabs={[
              { id: 'obiettivi', label: 'Obiettivi' },
              { id: 'match', label: 'Match' },
            ]}
            active={studentTab}
            onChange={setStudentTab}
          />

          <div className="mt-5">
            {studentTab === 'obiettivi' && (
              <>
                {/* Desktop only: inline button */}
                <div className="hidden sm:flex justify-end mb-4">
                  <Button variant="primary" onClick={() => { setEditingGoal(null); setGoalFormOpen(true); }}>
                    + Nuovo obiettivo
                  </Button>
                </div>
                {studentGoals.length === 0 ? (
                  <EmptyState
                    icon="🎯"
                    title="Nessun obiettivo"
                    message="Crea il primo obiettivo per questo allievo!"
                    action={<Button variant="primary" onClick={() => { setEditingGoal(null); setGoalFormOpen(true); }}>Crea obiettivo</Button>}
                  />
                ) : (
                  <KanbanBoard
                    goals={studentGoals}
                    isCoach={true}
                    onEdit={(g) => { setEditingGoal(g); setGoalFormOpen(true); }}
                    onDelete={handleDeleteGoal}
                    onStatusChange={handleGoalStatusChange}
                    onProgressChange={handleGoalProgressChange}
                  />
                )}
                <GoalForm
                  open={goalFormOpen}
                  onClose={() => { setGoalFormOpen(false); setEditingGoal(null); }}
                  onSave={handleSaveGoal}
                  goal={editingGoal}
                  isCoach={true}
                />
              </>
            )}

            {studentTab === 'match' && (
              <>
                {/* Desktop only: inline button */}
                <div className="hidden sm:flex justify-end mb-4">
                  <Button variant="primary" onClick={() => { setEditingMatch(null); setMatchFormOpen(true); }}>
                    + Aggiungi Match
                  </Button>
                </div>
                {studentMatches.length === 0 ? (
                  <EmptyState
                    icon="🏆"
                    title="Nessun match"
                    message="Questo allievo non ha ancora registrato match."
                    action={<Button variant="primary" onClick={() => { setEditingMatch(null); setMatchFormOpen(true); }}>Aggiungi match</Button>}
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {studentMatches.map((m) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        isCoach={true}
                        onEdit={(m) => { setEditingMatch(m); setMatchFormOpen(true); }}
                        onDelete={handleDeleteMatch}
                        onEditCoachNotes={(m) => { setCoachNotesMatch(m); setCoachNotesOpen(true); }}
                      />
                    ))}
                  </div>
                )}
                <MatchForm
                  open={matchFormOpen}
                  onClose={() => { setMatchFormOpen(false); setEditingMatch(null); }}
                  onSave={handleSaveMatch}
                  match={editingMatch}
                />
                <CoachNotesForm
                  open={coachNotesOpen}
                  onClose={() => { setCoachNotesOpen(false); setCoachNotesMatch(null); }}
                  onSave={handleSaveCoachNotes}
                  currentNotes={coachNotesMatch?.coach_notes}
                />
              </>
            )}
          </div>
        </main>

        {/* ─── Mobile FAB (student detail) ─── */}
        <button
          onClick={handleStudentFabClick}
          className="sm:hidden fixed bottom-6 right-5 z-40 w-14 h-14 rounded-full bg-[var(--club-red)] text-white shadow-lg shadow-[var(--club-red)]/30 flex items-center justify-center active:scale-90 transition-transform"
          aria-label={studentTab === 'obiettivi' ? 'Nuovo obiettivo' : 'Aggiungi match'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    );
  }

  // ─── Main view ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-6">
        {/* Stats + Invite (desktop) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--club-blue-light)] flex items-center justify-center">
              <span className="text-lg">👥</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--club-blue)]">{students.filter(s => s.active).length}</p>
              <p className="text-xs text-gray-500">Allievi attivi</p>
            </div>
          </div>
          <div className="hidden sm:block">
            <Button variant="primary" onClick={() => { setInviteModalOpen(true); setInviteResult(null); setInviteEmail(''); }}>
              ✉️ Invita allievo
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          tabs={[
            { id: 'allievi', label: 'Allievi' },
            { id: 'risultati', label: 'Risultati Agonistici' },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />

        <div className="mt-5">
          {activeTab === 'allievi' && (
            <>
              <SearchBar value={search} onChange={setSearch} placeholder="Cerca allievo per nome o email..." />
              {loading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : filteredStudents.length === 0 ? (
                <EmptyState icon="👥" title="Nessun allievo trovato" message={search ? 'Prova con un altro termine di ricerca.' : 'Invita il tuo primo allievo!'} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
                  {filteredStudents.map((student) => (
                    <StudentCard key={student.id} student={student} onClick={() => { setSelectedStudent(student); setStudentTab('obiettivi'); }} />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'risultati' && (
            <>
              {allMatchesLoading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : allMatches.length === 0 ? (
                <EmptyState icon="🏆" title="Nessun risultato" message="Gli allievi non hanno ancora registrato match." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
                  {allMatches.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      showStudentName={true}
                      isCoach={true}
                      onEdit={(m) => {
                        const stu = students.find((s) => s.id === m.student_id);
                        if (stu) {
                          setSelectedStudent(stu);
                          setStudentTab('match');
                        }
                      }}
                      onDelete={handleDeleteMatch}
                      onEditCoachNotes={(m) => { setCoachNotesMatch(m); setCoachNotesOpen(true); }}
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
        </div>
      </main>

      {/* ─── Mobile FAB (main view — invite) ─── */}
      <button
        onClick={() => { setInviteModalOpen(true); setInviteResult(null); setInviteEmail(''); }}
        className="sm:hidden fixed bottom-6 right-5 z-40 w-14 h-14 rounded-full bg-[var(--club-red)] text-white shadow-lg shadow-[var(--club-red)]/30 flex items-center justify-center active:scale-90 transition-transform"
        aria-label="Invita allievo"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Invite modal */}
      <Modal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)} title="Invita allievo">
        <div className="flex flex-col gap-4">
          <Input
            label="Email dell'allievo"
            type="email"
            value={inviteEmail}
            onChange={setInviteEmail}
            placeholder="allievo@email.com"
            required
          />
          <Button variant="primary" loading={inviteLoading} onClick={handleInvite}>
            Genera link invito
          </Button>

          {inviteResult?.token && (
            <div className="bg-green-50 rounded-xl p-4 border border-green-100">
              <p className="text-sm font-medium text-green-800 mb-2">Link generato!</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteResult.token}
                  className="flex-1 text-xs bg-white border border-green-200 rounded-lg px-3 py-2 font-mono"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(inviteResult.token!); }}
                >
                  Copia
                </Button>
              </div>
              <p className="text-[11px] text-green-600 mt-2">Valido per 7 giorni. Invia questo link all&apos;allievo.</p>
            </div>
          )}

          {inviteResult?.error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">
              {inviteResult.error}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ─── StudentCard (coach list) ────────────────────────

function StudentCard({ student, onClick }: { student: Profile; onClick: () => void }) {
  const [stats, setStats] = useState({ goals: 0, completed: 0, matches: 0, wins: 0 });
  const { displayLevel, displayRanking } = getDisplayRanking(student);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md hover:border-[var(--club-blue)]/20 transition-all cursor-pointer animate-fade-in"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-[var(--club-blue)] flex items-center justify-center text-white text-sm font-bold shrink-0">
          {student.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{student.full_name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge>{displayLevel}</Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-3">
        <span className="text-xs text-gray-500">Classifica FIT:</span>
        <span className="text-xs font-semibold text-[var(--club-red)]">{displayRanking}</span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center pt-3 border-t border-gray-50">
        <div>
          <p className="text-sm font-bold text-[var(--club-blue)]">{stats.goals}</p>
          <p className="text-[10px] text-gray-400">Obiettivi</p>
        </div>
        <div>
          <p className="text-sm font-bold text-green-600">{stats.completed}</p>
          <p className="text-[10px] text-gray-400">Completati</p>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-700">{stats.matches}</p>
          <p className="text-[10px] text-gray-400">Match</p>
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--club-red)]">{stats.wins}</p>
          <p className="text-[10px] text-gray-400">Vittorie</p>
        </div>
      </div>
    </div>
  );
}
