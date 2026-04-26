'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Tabs, SearchBar, Spinner, Badge, EmptyState, ConfirmDialog } from '@/components/UI';
import type { Profile, MatchResultRow } from '@/lib/database.types';
import { getDisplayRanking, getAgeCategory, isClassified } from '@/lib/constants';
import { MatchCard } from '@/components/MatchCard';
import { CoachNotesForm } from '@/components/CoachNotesForm';
import { CoachMobileDashboard } from './CoachMobileDashboard';
import { PendingCard } from './components/PendingCard';
import { PlayerView } from '../student/PlayerView';

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
  const [activeTab, setActiveTab] = useState<'allievi' | 'risultati' | 'richieste'>('allievi');
  const [students, setStudents] = useState<Profile[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);

  const [allMatches, setAllMatches] = useState<MatchResultRow[]>([]);
  const [allMatchesLoading, setAllMatchesLoading] = useState(false);

  const [coachNotesOpen, setCoachNotesOpen] = useState(false);
  const [coachNotesMatch, setCoachNotesMatch] = useState<MatchResultRow | null>(null);

  const [confirmReject, setConfirmReject] = useState<Profile | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const [reloadTick, setReloadTick] = useState(0);
  const refresh = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, p] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'allievo').eq('approval_status', 'approved').eq('active', true).order('full_name'),
        supabase.from('profiles').select('*').eq('role', 'allievo').eq('approval_status', 'pending').order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      setStudents((s.data as Profile[]) || []);
      setPendingProfiles((p.data as Profile[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

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
  }, [activeTab, reloadTick]);

  const filteredStudents = students.filter((s) =>
    `${s.full_name} ${s.email}`.toLowerCase().includes(search.toLowerCase())
  );

  // ─── Approve / Reject ──────────────────────────────
  const handleApprove = async (p: Profile) => {
    setActingOn(p.id);
    await supabase.from('profiles').update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user?.id ?? null,
    }).eq('id', p.id);
    refresh();
    setActingOn(null);
  };

  const handleReject = async (p: Profile) => {
    setActingOn(p.id);
    await supabase.from('profiles').update({
      approval_status: 'rejected',
      approved_at: new Date().toISOString(),
      approved_by: user?.id ?? null,
    }).eq('id', p.id);
    refresh();
    setConfirmReject(null);
    setActingOn(null);
  };

  // ─── Match coach-notes from Risultati tab ──────────
  const handleSaveCoachNotes = async (notes: string) => {
    if (coachNotesMatch) {
      await supabase.from('match_results').update({ coach_notes: notes || null }).eq('id', coachNotesMatch.id);
      refresh();
    }
  };

  const handleDeleteMatch = async (id: string) => {
    await supabase.from('match_results').delete().eq('id', id);
    refresh();
  };

  // ─── Student detail (uses shared PlayerView) ───────
  if (selectedStudent) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
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
          onChange={(t) => setActiveTab(t as typeof activeTab)}
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
                    <StudentCard key={student.id} student={student} onClick={() => setSelectedStudent(student)} />
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
    </div>
  );
}

// ─── Desktop StudentCard (in the Allievi list) ─────────
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
            {cardAgeCategory && <Badge color="var(--club-blue)" bg="var(--club-blue-light)">{cardAgeCategory}</Badge>}
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
