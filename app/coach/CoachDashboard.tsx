'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button, Tabs, SearchBar, Spinner, Badge, EmptyState, ConfirmDialog } from '@/components/UI';
import type { Profile, Goal, MatchResultRow, GoalStatus } from '@/lib/database.types';
import { getDisplayRanking, getAgeCategory, isClassified } from '@/lib/constants';
import { KanbanBoard } from '@/components/KanbanBoard';
import { GoalForm } from '@/components/GoalForm';
import { MatchCard } from '@/components/MatchCard';
import { MatchForm } from '@/components/MatchForm';
import { CoachNotesForm } from '@/components/CoachNotesForm';
import { CoachMobileDashboard } from './CoachMobileDashboard';

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

function CoachDesktopDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('allievi');
  const [students, setStudents] = useState<Profile[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);

  const [studentTab, setStudentTab] = useState('obiettivi');
  const [studentGoals, setStudentGoals] = useState<Goal[]>([]);
  const [studentMatches, setStudentMatches] = useState<MatchResultRow[]>([]);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [matchFormOpen, setMatchFormOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<MatchResultRow | null>(null);
  const [coachNotesOpen, setCoachNotesOpen] = useState(false);
  const [coachNotesMatch, setCoachNotesMatch] = useState<MatchResultRow | null>(null);

  const [allMatches, setAllMatches] = useState<MatchResultRow[]>([]);
  const [allMatchesLoading, setAllMatchesLoading] = useState(false);

  const [confirmReject, setConfirmReject] = useState<Profile | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const refetchStudents = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'allievo')
      .eq('approval_status', 'approved')
      .eq('active', true)
      .order('full_name');
    setStudents((data as Profile[]) || []);
  }, []);

  const refetchPending = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'allievo')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });
    setPendingProfiles((data as Profile[]) || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([refetchStudents(), refetchPending()]);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refetchStudents, refetchPending]);

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

  // ─── Approve / Reject ──────────────────────────────
  const handleApprove = async (p: Profile) => {
    setActingOn(p.id);
    await supabase.from('profiles').update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user?.id ?? null,
    }).eq('id', p.id);
    await Promise.all([refetchStudents(), refetchPending()]);
    setActingOn(null);
  };

  const handleReject = async (p: Profile) => {
    setActingOn(p.id);
    await supabase.from('profiles').update({
      approval_status: 'rejected',
      approved_at: new Date().toISOString(),
      approved_by: user?.id ?? null,
    }).eq('id', p.id);
    await refetchPending();
    setConfirmReject(null);
    setActingOn(null);
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
    const detailClassified = isClassified(displayRanking);
    const detailAgeCategory = getAgeCategory(selectedStudent.birth_date);

    return (
      <div className="min-h-screen bg-[var(--background)]">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <button
            onClick={() => setSelectedStudent(null)}
            className="flex items-center gap-2 text-[13px] font-medium text-gray-500 hover:text-[var(--club-blue)] mb-5 transition-colors group"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-0.5 transition-transform">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Torna alla lista
          </button>

          <div className="card p-5 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--club-blue)] to-[var(--club-blue-dark)] flex items-center justify-center text-white text-xl font-bold shadow-sm">
                {selectedStudent.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 tracking-[-0.02em]">{selectedStudent.full_name}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {detailAgeCategory && (
                    <Badge color="var(--club-blue)" bg="var(--club-blue-light)">{detailAgeCategory}</Badge>
                  )}
                  {detailClassified ? (
                    <Badge color="var(--club-red)" bg="var(--club-red-light)">FIT: {displayRanking}</Badge>
                  ) : (
                    <>
                      <Badge>{displayLevel}</Badge>
                      <Badge color="var(--muted)" bg="#F3F4F6">Non classificato</Badge>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-center sm:gap-5">
                <div>
                  <p className="text-lg font-bold text-[var(--club-blue)]">{gs.total}</p>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Obiettivi</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--success)]">{gs.completed}</p>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Completati</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-700">{ms.total}</p>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Match</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--club-red)]">{ms.wins}</p>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Vittorie</p>
                </div>
              </div>
            </div>
          </div>

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
                <div className="flex justify-end mb-4">
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
                <div className="flex justify-end mb-4">
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
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
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

        <button
          onClick={handleStudentFabClick}
          className="hidden"
          aria-label={studentTab === 'obiettivi' ? 'Nuovo obiettivo' : 'Aggiungi match'}
        />
      </div>
    );
  }

  // ─── Main view ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="card px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--club-blue-light)] flex items-center justify-center">
                <span className="text-lg">👥</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--club-blue)] tracking-[-0.02em]">{students.length}</p>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Allievi attivi</p>
              </div>
            </div>
            <div className="card px-5 py-4 flex items-center gap-3 relative">
              {pendingProfiles.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1.5 rounded-full bg-[var(--club-red)] text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                  {pendingProfiles.length}
                </span>
              )}
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <span className="text-lg">📥</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600 tracking-[-0.02em]">{pendingProfiles.length}</p>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Richieste</p>
              </div>
            </div>
          </div>
        </div>

        <Tabs
          tabs={[
            { id: 'allievi', label: `Allievi (${students.length})` },
            { id: 'risultati', label: 'Risultati Agonistici' },
            { id: 'richieste', label: `Richieste${pendingProfiles.length > 0 ? ` · ${pendingProfiles.length}` : ''}` },
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
                <EmptyState
                  icon="👥"
                  title="Nessun allievo"
                  message={search ? 'Nessun risultato per la ricerca.' : 'Non ci sono ancora allievi approvati. Le richieste di registrazione le trovi nella tab "Richieste".'}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4 stagger-children">
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
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4 stagger-children">
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

          {activeTab === 'richieste' && (
            <>
              <div className="card p-4 mb-5 flex items-start gap-3 bg-blue-50/40 border-blue-100">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B3A5C" strokeWidth="2" className="shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-[var(--club-blue)]">Approvazioni allievi</p>
                  <p className="text-[12px] text-gray-600 leading-relaxed mt-0.5">
                    Gli allievi si registrano in autonomia e attendono qui la tua approvazione. Una volta approvati potranno accedere alla loro dashboard.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : pendingProfiles.length === 0 ? (
                <EmptyState icon="✅" title="Tutto in ordine" message="Nessuna richiesta di registrazione in attesa." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 stagger-children">
                  {pendingProfiles.map((p) => (
                    <PendingDesktopCard
                      key={p.id}
                      profile={p}
                      busy={actingOn === p.id}
                      onApprove={() => handleApprove(p)}
                      onReject={() => setConfirmReject(p)}
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
    </div>
  );
}

// ─── StudentCard (coach list) ────────────────────────
function StudentCard({ student, onClick }: { student: Profile; onClick: () => void }) {
  const [stats, setStats] = useState({ goals: 0, completed: 0, matches: 0, wins: 0 });
  const { displayLevel, displayRanking } = getDisplayRanking(student);
  const cardClassified = isClassified(displayRanking);
  const cardAgeCategory = getAgeCategory(student.birth_date);

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
    <div onClick={onClick} className="card card-interactive p-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--club-blue)] to-[var(--club-blue-dark)] flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
          {student.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-gray-900 truncate tracking-[-0.01em]">{student.full_name}</h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {cardAgeCategory && (
              <Badge color="var(--club-blue)" bg="var(--club-blue-light)">{cardAgeCategory}</Badge>
            )}
            {!cardClassified && <Badge>{displayLevel}</Badge>}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" className="shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      <div className="flex items-center gap-1.5 mb-3 pl-0.5">
        <span className="text-[11px] text-gray-400 font-medium">Classifica FIT:</span>
        <span className="text-[11px] font-bold text-[var(--club-red)]">{cardClassified ? displayRanking : 'Non classificato'}</span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center pt-3 border-t border-gray-100">
        <div>
          <p className="text-sm font-bold text-[var(--club-blue)]">{stats.goals}</p>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Obiettivi</p>
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--success)]">{stats.completed}</p>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Completati</p>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-700">{stats.matches}</p>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Match</p>
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--club-red)]">{stats.wins}</p>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Vittorie</p>
        </div>
      </div>
    </div>
  );
}

// ─── PendingDesktopCard ──────────────────────────────
function ageLabelFrom(createdAt: string): string {
  const ageMin = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (ageMin < 60) return `${ageMin}min fa`;
  if (ageMin < 60 * 24) return `${Math.floor(ageMin / 60)}h fa`;
  return `${Math.floor(ageMin / (60 * 24))}g fa`;
}

function PendingDesktopCard({ profile, busy, onApprove, onReject }: { profile: Profile; busy: boolean; onApprove: () => void; onReject: () => void }) {
  const initial = profile.full_name.charAt(0).toUpperCase();
  const ageLabel = ageLabelFrom(profile.created_at);
  const pendingClassified = isClassified(profile.ranking);
  const pendingAgeCategory = getAgeCategory(profile.birth_date);

  return (
    <div className="card p-5 animate-fade-in">
      <div className="flex items-center gap-3.5 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--club-blue)] to-[var(--club-blue-dark)] flex items-center justify-center text-white text-base font-bold shadow-sm shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-gray-900 tracking-[-0.01em] truncate">{profile.full_name}</h3>
          <p className="text-[12px] text-[var(--club-blue)] truncate">{profile.email}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {pendingAgeCategory && (
              <Badge color="var(--club-blue)" bg="var(--club-blue-light)">{pendingAgeCategory}</Badge>
            )}
            {pendingClassified ? (
              <Badge color="var(--club-red)" bg="var(--club-red-light)">FIT: {profile.ranking}</Badge>
            ) : (
              <Badge>{profile.level}</Badge>
            )}
            <span className="text-[10px] text-gray-400">· {ageLabel}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          disabled={busy}
          onClick={onReject}
          className="py-2.5 rounded-xl border-2 border-red-100 text-[var(--club-red)] text-[13px] font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          ✕ Rifiuta
        </button>
        <button
          disabled={busy}
          onClick={onApprove}
          className="py-2.5 rounded-xl bg-[var(--success)] text-white text-[13px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
        >
          ✓ Approva
        </button>
      </div>
    </div>
  );
}
