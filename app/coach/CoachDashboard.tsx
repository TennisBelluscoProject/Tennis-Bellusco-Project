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
  const [activeTab, setActiveTab] = useState<'allievi' | 'catalogo' | 'risultati' | 'richieste'>('allievi');
  const [students, setStudents] = useState<Profile[]>([]);
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

      const [s, p, goalsRes, matchesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'allievo').eq('approval_status', 'approved').eq('active', true).order('full_name'),
        supabase.from('profiles').select('*').eq('role', 'allievo').eq('approval_status', 'pending').order('created_at', { ascending: false }),
        supabase.from('goals').select('id, created_at'),
        supabase.from('match_results').select('id, result, match_date'),
      ]);
      if (cancelled) return;

      const studentList = (s.data as Profile[]) || [];
      const goals = (goalsRes.data as { id: string; created_at: string }[]) || [];
      const matches = (matchesRes.data as { id: string; result: string; match_date: string }[]) || [];

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
      setPendingProfiles((p.data as Profile[]) || []);
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
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-6">
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
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="sticky top-16 z-30 bg-[var(--background)] -mx-4 sm:-mx-6 px-4 sm:px-6 pt-6 pb-3">
          <ClubOverview stats={clubStats} />

          <Tabs
            tabs={[
              { id: 'allievi', label: `Allievi (${students.length})` },
              { id: 'catalogo', label: 'Catalogo' },
              { id: 'risultati', label: 'Risultati Agonistici' },
              { id: 'richieste', label: `Richieste${pendingProfiles.length > 0 ? ` · ${pendingProfiles.length}` : ''}` },
            ]}
            active={activeTab}
            onChange={(t) => setActiveTab(t as typeof activeTab)}
          />

          {activeTab === 'allievi' && (
            <div className="mt-4">
              <SearchBar value={search} onChange={setSearch} placeholder="Cerca allievo per nome o email..." />
            </div>
          )}

          {activeTab === 'catalogo' && (
            <div className="mt-4 flex flex-col gap-3">
              <GoalTemplatesHeader ctx={catalogCtx} isMobile={false} />
            </div>
          )}

          {activeTab === 'richieste' && (
            <div className="mt-4 card p-4 flex items-start gap-3 bg-blue-50/40 border-blue-100">
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
          )}
        </div>

        <div className="mt-5">
          {activeTab === 'allievi' && (
            <>
              {loading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : filteredStudents.length === 0 ? (
                <EmptyState
                  icon="👥"
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

          {activeTab === 'catalogo' && (
            <GoalTemplatesList ctx={catalogCtx} isMobile={false} />
          )}

          {activeTab === 'risultati' && (
            <>
              {allMatchesLoading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : allMatches.length === 0 ? (
                <EmptyState icon="🏆" title="Nessun risultato" message="Gli allievi non hanno ancora registrato match." />
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

// ─── Club Overview Panel ──────────────────────────────
const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function ClubOverview({ stats }: { stats: ClubStats | null }) {
  const now = new Date();
  const monthLabel = `${IT_MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="relative overflow-hidden rounded-3xl mb-6 px-7 py-6 text-white shadow-[var(--shadow-md)]"
      style={{ background: 'linear-gradient(135deg, #1B3A5C 0%, #122840 100%)' }}>
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 w-72 h-72 rounded-full bg-white/[0.03]" />
      <div aria-hidden className="pointer-events-none absolute right-10 -bottom-24 w-56 h-56 rounded-full bg-white/[0.025]" />

      <div className="relative flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] text-white/95">PANORAMICA CLUB</p>
          <p className="text-[12px] text-white/55 mt-1">Dati aggregati · {monthLabel}</p>
        </div>
        <span className="text-[10px] font-bold tracking-[0.15em] text-emerald-400 border border-emerald-400/40 rounded-full px-2.5 py-1">
          NUOVO
        </span>
      </div>

      <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-5">
        <OverviewStat
          icon={<UsersIcon />}
          iconBg="rgba(167, 139, 250, 0.18)"
          iconColor="#C4B5FD"
          label="Allievi attivi"
          value={stats ? String(stats.studentsTotal) : '—'}
          delta={stats ? formatDelta(stats.studentsMonth) : ''}
        />
        <OverviewStat
          icon={<TargetIcon />}
          iconBg="rgba(244, 114, 182, 0.18)"
          iconColor="#F9A8D4"
          label="Obiettivi totali"
          value={stats ? String(stats.goalsTotal) : '—'}
          delta={stats ? formatDelta(stats.goalsMonth) : ''}
        />
        <OverviewStat
          icon={<RacketIcon />}
          iconBg="rgba(34, 211, 238, 0.18)"
          iconColor="#67E8F9"
          label="Match totali"
          value={stats ? String(stats.matchesTotal) : '—'}
          delta={stats ? formatDelta(stats.matchesMonth) : ''}
        />
        <OverviewStat
          icon={<TrophyIcon />}
          iconBg="rgba(250, 204, 21, 0.18)"
          iconColor="#FDE68A"
          label="Win rate generale"
          value={stats ? `${stats.winRate}%` : '—'}
          delta={stats ? formatDelta(stats.winRateDelta, '%') : ''}
        />
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
  icon, iconBg, iconColor, label, value, delta,
}: { icon: React.ReactNode; iconBg: string; iconColor: string; label: string; value: string; delta: string }) {
  const isPositive = delta.startsWith('↑');
  const isNeutral = delta.startsWith('±');
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
          style={{ background: iconBg, color: iconColor }}>
          {icon}
        </span>
        <span className="text-[10.5px] font-semibold tracking-[0.14em] text-white/70 uppercase">{label}</span>
      </div>
      <p className="text-[32px] leading-none font-bold tracking-[-0.02em] mb-2">{value}</p>
      <p className={`text-[12px] font-medium ${isPositive ? 'text-emerald-400' : isNeutral ? 'text-white/50' : 'text-rose-400'}`}>
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
