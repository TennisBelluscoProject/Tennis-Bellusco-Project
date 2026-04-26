'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner, Badge, EmptyState, SearchBar, Tabs, ConfirmDialog, Button } from '@/components/UI';
import type { Profile, Goal, MatchResultRow, GoalStatus } from '@/lib/database.types';
import { getDisplayRanking, getAgeCategory, isClassified } from '@/lib/constants';
import { KanbanBoard } from '@/components/KanbanBoard';
import { GoalForm } from '@/components/GoalForm';
import { MatchCard } from '@/components/MatchCard';
import { MatchForm } from '@/components/MatchForm';
import { CoachNotesForm } from '@/components/CoachNotesForm';

type TabId = 'home' | 'allievi' | 'risultati' | 'richieste';

const DISMISSED_KEY = 'tcb-dismissed-notifs-v1';

// ─── Utility: activity dot ──────────────────────────────
function getActivityDot(lastActivity: Date | null): { color: string; bg: string; label: string } {
  if (!lastActivity) return { color: '#D1D5DB', bg: '#D1D5DB', label: 'Inattivo' };
  const ageMs = Date.now() - lastActivity.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (ageMs < day) return { color: '#16a34a', bg: '#16a34a', label: 'Attivo' };
  if (ageMs < 7 * day) return { color: '#E65100', bg: '#E65100', label: 'Inattivo recente' };
  return { color: '#D1D5DB', bg: '#D1D5DB', label: 'Inattivo' };
}

function isActiveToday(activity: Date | null): boolean {
  if (!activity) return false;
  return Date.now() - activity.getTime() < 24 * 60 * 60 * 1000;
}

function timeAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return 'ora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h fa`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}g fa`;
  if (d < 30) return `${Math.floor(d / 7)} sett fa`;
  if (d < 365) return `${Math.floor(d / 30)} mesi fa`;
  return `${Math.floor(d / 365)} anni fa`;
}

function formatDateLong(d: Date): string {
  const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

// ─── Top Header (mobile) ────────────────────────────────
function MobileHeader({ onLogout }: { onLogout: () => void }) {
  return (
    <>
      <header className="sticky top-0 z-30 bg-white/98 backdrop-blur-lg border-b border-gray-100/80">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--club-red)] flex items-center justify-center shadow-sm relative overflow-hidden shrink-0">
              <span className="text-lg relative z-10">🎾</span>
              <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] font-bold text-[var(--club-blue)] leading-tight tracking-[-0.01em] truncate" style={{ fontFamily: 'var(--font-display)' }}>
                Tennis Club Bellusco
              </span>
              <span className="text-[11px] text-[var(--muted)] leading-tight mt-0.5">Dashboard Maestro</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            aria-label="Esci"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-[var(--club-red)] hover:bg-[var(--club-red-light)] transition-colors shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>
      <div className="club-stripe" />
    </>
  );
}

// ─── Bottom Tab Bar ────────────────────────────────────
function BottomNav({ active, onChange, pendingCount }: { active: TabId; onChange: (t: TabId) => void; pendingCount: number }) {
  const items: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <IconHome /> },
    { id: 'allievi', label: 'Allievi', icon: <IconUsers /> },
    { id: 'risultati', label: 'Risultati', icon: <IconTrophy /> },
    { id: 'richieste', label: 'Richieste', icon: <IconUserPlus /> },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/98 backdrop-blur-lg border-t border-gray-100" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around px-2 pt-2 pb-1.5">
        {items.map((it) => {
          const isActive = active === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                isActive ? 'text-[var(--club-blue)]' : 'text-gray-400'
              }`}
            >
              <div className="relative">
                {it.icon}
                {it.id === 'richieste' && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--club-red)] text-white text-[9px] font-bold flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-semibold tracking-tight ${isActive ? 'text-[var(--club-blue)]' : 'text-gray-400'}`}>{it.label}</span>
              {isActive && <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-[2.5px] rounded-full bg-[var(--club-blue)]" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function IconHome() { return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9" /><path d="M5 10v10h14V10" /></svg>); }
function IconUsers() { return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>); }
function IconTrophy() { return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" /><path d="M17 4h3v3a3 3 0 01-3 3" /><path d="M7 4H4v3a3 3 0 003 3" /></svg>); }
function IconUserPlus() { return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>); }

// ─── Main Component ─────────────────────────────────────
export function CoachMobileDashboard() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<TabId>('home');

  const [students, setStudents] = useState<Profile[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<Profile[]>([]);
  const [studentActivity, setStudentActivity] = useState<Record<string, Date | null>>({});
  const [studentStats, setStudentStats] = useState<Record<string, { matches: number; wins: number; goals: number }>>({});
  const [allMatches, setAllMatches] = useState<MatchResultRow[]>([]);
  const [recentGoals, setRecentGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'win' | 'loss'>('all');
  const [notifFilter, setNotifFilter] = useState<'all' | 'goal' | 'match'>('all');

  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { return new Set(); }
  });

  // Detail view state (mobile pushes student detail full screen)
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);

  const persistDismissed = (s: Set<string>) => {
    setDismissed(s);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s])); } catch {}
  };

  const [reloadTick, setReloadTick] = useState(0);
  const fetchAll = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [
        studentsRes,
        pendingRes,
        matchesRes,
        goalsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'allievo').eq('approval_status', 'approved').eq('active', true).order('full_name'),
        supabase.from('profiles').select('*').eq('role', 'allievo').eq('approval_status', 'pending').order('created_at', { ascending: false }),
        supabase.from('match_results').select('*, profiles!match_results_student_id_fkey(full_name)').order('match_date', { ascending: false }).limit(150),
        supabase.from('goals').select('*, profiles!goals_student_id_fkey(full_name)').order('updated_at', { ascending: false }).limit(150),
      ]);
      if (cancelled) return;

      const sList = (studentsRes.data as Profile[]) || [];
      const matches = (matchesRes.data as MatchResultRow[]) || [];
      const goals = (goalsRes.data as Goal[]) || [];

      const activity: Record<string, Date | null> = {};
      const stats: Record<string, { matches: number; wins: number; goals: number }> = {};
      for (const s of sList) {
        activity[s.id] = null;
        stats[s.id] = { matches: 0, wins: 0, goals: 0 };
      }
      for (const m of matches) {
        const sid = m.student_id;
        if (!stats[sid]) continue;
        stats[sid].matches += 1;
        if (m.result === 'win') stats[sid].wins += 1;
        const dt = new Date(m.created_at);
        if (!activity[sid] || dt > activity[sid]!) activity[sid] = dt;
      }
      for (const g of goals) {
        const sid = g.student_id;
        if (!stats[sid]) continue;
        if (g.status !== 'completed') stats[sid].goals += 1;
        const dt = new Date(g.updated_at);
        if (!activity[sid] || dt > activity[sid]!) activity[sid] = dt;
      }

      setStudents(sList);
      setPendingProfiles((pendingRes.data as Profile[]) || []);
      setAllMatches(matches);
      setRecentGoals(goals);
      setStudentActivity(activity);
      setStudentStats(stats);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  // ─── Derived: stats ───────────────────────────────────
  const totalStudents = students.length;
  const activeGoals = recentGoals.filter((g) => g.status !== 'completed' && students.some((s) => s.id === g.student_id)).length;
  const winRate = useMemo(() => {
    if (allMatches.length === 0) return 0;
    const wins = allMatches.filter((m) => m.result === 'win').length;
    return Math.round((wins / allMatches.length) * 100);
  }, [allMatches]);
  const matchesThisMonth = useMemo(() => {
    const now = new Date();
    return allMatches.filter((m) => {
      const d = new Date(m.match_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [allMatches]);

  // ─── Notifications feed (derived from data) ───────────
  type Notif = { id: string; kind: 'goal' | 'match'; studentName: string; title: string; subtitle: string; date: Date };
  const notifications = useMemo<Notif[]>(() => {
    const list: Notif[] = [];
    for (const g of recentGoals) {
      if (g.status === 'completed' && g.completed_at) {
        const studentName = (g as Goal & { profiles?: { full_name: string } }).profiles?.full_name || '';
        list.push({
          id: `goal:${g.id}`,
          kind: 'goal',
          studentName,
          title: 'OBIETTIVO COMPLETATO',
          subtitle: g.title,
          date: new Date(g.completed_at),
        });
      }
    }
    for (const m of allMatches) {
      const studentName = m.profiles?.full_name || '';
      const opponent = m.opponent_name ? `vs ${m.opponent_name}` : 'Match';
      const score = m.score ? ` — ${m.score}` : '';
      const outcome = m.result === 'win' ? 'Vittoria' : m.result === 'loss' ? 'Sconfitta' : m.result;
      list.push({
        id: `match:${m.id}`,
        kind: 'match',
        studentName,
        title: 'MATCH AGGIUNTO',
        subtitle: `${opponent}${score} (${outcome})`,
        date: new Date(m.created_at),
      });
    }
    return list
      .filter((n) => !dismissed.has(n.id))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 30);
  }, [recentGoals, allMatches, dismissed]);

  const filteredNotifs = notifications.filter((n) => notifFilter === 'all' || n.kind === notifFilter);
  const goalNotifsCount = notifications.filter((n) => n.kind === 'goal').length;
  const matchNotifsCount = notifications.filter((n) => n.kind === 'match').length;

  // ─── Approve / Reject ─────────────────────────────────
  const [confirmReject, setConfirmReject] = useState<Profile | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const handleApprove = async (p: Profile) => {
    setActingOn(p.id);
    await supabase.from('profiles').update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user?.id ?? null,
    }).eq('id', p.id);
    await fetchAll();
    setActingOn(null);
  };
  const handleReject = async (p: Profile) => {
    setActingOn(p.id);
    await supabase.from('profiles').update({
      approval_status: 'rejected',
      approved_at: new Date().toISOString(),
      approved_by: user?.id ?? null,
    }).eq('id', p.id);
    await fetchAll();
    setConfirmReject(null);
    setActingOn(null);
  };

  // ─── Selected student detail ──────────────────────────
  if (selectedStudent) {
    return (
      <StudentDetailMobile
        student={selectedStudent}
        onBack={() => { setSelectedStudent(null); fetchAll(); }}
        onLogout={signOut}
        coachId={user?.id ?? null}
      />
    );
  }

  // ─── Active students today (used in greeting) ─────────
  const activeToday = students.filter((s) => isActiveToday(studentActivity[s.id] ?? null)).length;

  const filteredStudents = students.filter((s) =>
    `${s.full_name} ${s.email ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMatches = allMatches.filter((m) => {
    if (resultFilter === 'win') return m.result === 'win';
    if (resultFilter === 'loss') return m.result === 'loss';
    return true;
  });
  const winsCount = allMatches.filter((m) => m.result === 'win').length;
  const lossesCount = allMatches.filter((m) => m.result === 'loss').length;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <MobileHeader onLogout={signOut} />

      <main className="pb-24">
        {tab === 'home' && (
          <div className="px-4 py-5 animate-fade-in">
            {/* Greeting (no maestro name) */}
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-gray-900 tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
                Benvenuto
              </h2>
              <p className="text-sm text-[var(--club-blue)] mt-1">
                {formatDateLong(new Date())} · {activeToday} {activeToday === 1 ? 'allievo attivo' : 'allievi attivi'} oggi
              </p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <StatPill label="Allievi" value={totalStudents} icon={<IconUsers />} accent="var(--club-blue)" />
              <StatPill label="Obiettivi attivi" value={activeGoals} icon={<span>🎯</span>} accent="#E65100" />
              <StatPill label="Win Rate" value={`${winRate}%`} icon={<span>🏆</span>} accent="var(--success)" valueColor="var(--success)" />
              <StatPill label="Match aprile" value={matchesThisMonth} icon={<span>📅</span>} accent="var(--club-red)" valueColor="var(--club-red)" />
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 tracking-[-0.01em]">Notifiche</h3>
                {notifications.length > 0 && (
                  <span className="text-[10px] font-bold text-white bg-[var(--club-red)] rounded-full px-2 py-0.5">
                    {notifications.length} {notifications.length === 1 ? 'nuova' : 'nuove'}
                  </span>
                )}
              </div>
              {notifications.length > 0 && (
                <button
                  onClick={() => persistDismissed(new Set([...dismissed, ...notifications.map((n) => n.id)]))}
                  className="text-[12px] font-medium text-gray-500 hover:text-[var(--club-red)] transition-colors"
                >
                  Cancella tutto
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 mb-4 overflow-x-auto -mx-4 px-4 pb-1">
              <FilterPill active={notifFilter === 'all'} onClick={() => setNotifFilter('all')} label="Tutte" count={notifications.length} />
              <FilterPill active={notifFilter === 'goal'} onClick={() => setNotifFilter('goal')} label="Obiettivi" count={goalNotifsCount} />
              <FilterPill active={notifFilter === 'match'} onClick={() => setNotifFilter('match')} label="Match" count={matchNotifsCount} />
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : filteredNotifs.length === 0 ? (
              <EmptyState icon="🔔" title="Nessuna notifica" message="Le attività degli allievi appariranno qui." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredNotifs.map((n) => (
                  <NotificationCard
                    key={n.id}
                    notif={n}
                    onDismiss={() => persistDismissed(new Set([...dismissed, n.id]))}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'allievi' && (
          <div className="px-4 py-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>Allievi</h2>
                <p className="text-[12px] text-gray-500 mt-0.5">{totalStudents} {totalStudents === 1 ? 'attivo' : 'attivi'}</p>
              </div>
            </div>

            <SearchBar value={search} onChange={setSearch} placeholder="Cerca allievo..." />

            <div className="mt-4">
              {loading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : filteredStudents.length === 0 ? (
                <EmptyState icon="👥" title="Nessun allievo" message={search ? 'Nessun risultato per la ricerca.' : 'Nessun allievo approvato. Le richieste di registrazione le trovi nella tab Richieste.'} />
              ) : (
                <div className="flex flex-col gap-2.5 stagger-children">
                  {filteredStudents.map((s) => {
                    const dot = getActivityDot(studentActivity[s.id] ?? null);
                    const stats = studentStats[s.id] ?? { matches: 0, wins: 0, goals: 0 };
                    return (
                      <StudentRowMobile
                        key={s.id}
                        student={s}
                        dot={dot}
                        stats={stats}
                        lastActivity={studentActivity[s.id] ?? null}
                        onClick={() => setSelectedStudent(s)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'risultati' && (
          <div className="px-4 py-5 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900 tracking-[-0.02em] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Risultati Agonistici
            </h2>

            <div className="flex gap-2 mb-4">
              <FilterPill active={resultFilter === 'all'} onClick={() => setResultFilter('all')} label="Tutti" count={allMatches.length} />
              <FilterPill active={resultFilter === 'win'} onClick={() => setResultFilter('win')} label="Vittorie" count={winsCount} />
              <FilterPill active={resultFilter === 'loss'} onClick={() => setResultFilter('loss')} label="Sconfitte" count={lossesCount} />
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : filteredMatches.length === 0 ? (
              <EmptyState icon="🏆" title="Nessun match" message="Non ci sono match registrati." />
            ) : (
              <div className="flex flex-col gap-2.5 stagger-children">
                {filteredMatches.map((m) => (
                  <CompactMatchCard key={m.id} match={m} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'richieste' && (
          <div className="px-4 py-5 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900 tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>Approvazioni</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 mb-5">
              {pendingProfiles.length} {pendingProfiles.length === 1 ? 'in attesa' : 'in attesa'}
            </p>

            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">In attesa di approvazione</p>

            {loading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : pendingProfiles.length === 0 ? (
              <EmptyState icon="✅" title="Tutto in ordine" message="Nessuna registrazione in attesa." />
            ) : (
              <div className="flex flex-col gap-3 stagger-children">
                {pendingProfiles.map((p) => (
                  <PendingCard
                    key={p.id}
                    profile={p}
                    busy={actingOn === p.id}
                    onApprove={() => handleApprove(p)}
                    onReject={() => setConfirmReject(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} pendingCount={pendingProfiles.length} />

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

// ─── Sub-components ─────────────────────────────────────

function StatPill({ label, value, icon, accent, valueColor }: { label: string; value: string | number; icon: React.ReactNode; accent: string; valueColor?: string }) {
  return (
    <div className="card stat-card p-3.5" style={{ '--stat-accent': accent } as React.CSSProperties}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: `${accent}1A`, color: accent }}>
        {icon}
      </div>
      <p className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: valueColor ?? 'var(--foreground)' }}>{value}</p>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

function FilterPill({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[13px] font-semibold transition-all ${
        active
          ? 'bg-white text-[var(--club-blue)] border-[var(--club-blue)]'
          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
      }`}
    >
      <span>{label}</span>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
        active ? 'bg-[var(--club-blue)] text-white' : 'bg-gray-100 text-gray-500'
      }`}>{count}</span>
    </button>
  );
}

function NotificationCard({ notif, onDismiss }: { notif: { id: string; kind: 'goal' | 'match'; studentName: string; title: string; subtitle: string; date: Date }; onDismiss: () => void }) {
  const isGoal = notif.kind === 'goal';
  const accent = isGoal ? 'var(--success)' : 'var(--club-blue)';
  const bg = isGoal ? '#dcfce7' : 'transparent';
  const border = isGoal ? '#86efac' : '#E2E4E9';
  const iconBg = isGoal ? '#bbf7d0' : '#E8EDF2';
  const iconColor = isGoal ? '#16a34a' : 'var(--club-blue)';

  return (
    <div
      className="rounded-2xl p-3.5 border flex items-start gap-3 animate-fade-in"
      style={{ background: bg, borderColor: border }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg, color: iconColor }}>
        {isGoal ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" /><path d="M17 4h3v3a3 3 0 01-3 3" /><path d="M7 4H4v3a3 3 0 003 3" /></svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>{notif.title}</span>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
        </div>
        <p className="text-[14px] font-bold text-gray-900 mt-0.5 truncate">{notif.studentName}</p>
        <p className="text-[12px] text-gray-600 truncate">{notif.subtitle}</p>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">{timeAgo(notif.date)}</span>
        <button
          onClick={onDismiss}
          aria-label="Cancella"
          className="w-6 h-6 rounded-md bg-white/80 border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

function StudentRowMobile({
  student, dot, stats, lastActivity, onClick,
}: {
  student: Profile;
  dot: { color: string; bg: string; label: string };
  stats: { matches: number; wins: number; goals: number };
  lastActivity: Date | null;
  onClick: () => void;
}) {
  const { displayLevel, displayRanking } = getDisplayRanking(student);
  const initial = student.full_name.charAt(0).toUpperCase();
  const winPct = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
  const classified = isClassified(displayRanking);
  const ageCategory = getAgeCategory(student.birth_date);

  return (
    <button onClick={onClick} className="card card-interactive p-4 text-left flex items-center gap-3.5">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--club-blue)] to-[var(--club-blue-dark)] flex items-center justify-center text-white text-base font-bold shrink-0 shadow-sm">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-bold text-gray-900 tracking-[-0.01em] truncate">{student.full_name}</h3>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {ageCategory && (
            <Badge color="var(--club-blue)" bg="var(--club-blue-light)">{ageCategory}</Badge>
          )}
          {classified ? (
            <span className="text-[11px] font-semibold text-[var(--club-red)]">FIT: {displayRanking}</span>
          ) : (
            <Badge>{displayLevel}</Badge>
          )}
        </div>
        <p className="text-[11px] text-gray-500 mt-1">
          {stats.matches} match{stats.matches > 0 ? <> · <span className="text-[var(--success)] font-bold">{winPct}% vinte</span></> : ''}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="w-2 h-2 rounded-full" style={{ background: dot.bg }} title={dot.label} />
        <span className="text-[10px] text-gray-400">
          {lastActivity ? timeAgo(lastActivity) : '—'}
        </span>
      </div>
    </button>
  );
}

function CompactMatchCard({ match }: { match: MatchResultRow }) {
  const isWin = match.result === 'win';
  const studentName = match.profiles?.full_name?.toUpperCase() || '';
  const date = new Date(match.match_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

  return (
    <div className="card p-4 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: isWin ? '#16a34a' : '#dc2626' }}
      />
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold tracking-wider text-gray-400">{studentName}</p>
          <p className="text-[14px] font-bold text-gray-900 truncate mt-0.5">{match.tournament_name || 'Match'}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {date}{match.opponent_name ? ` · vs ${match.opponent_name}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <p className="text-[15px] font-bold text-gray-900 score-display">{match.score || '—'}</p>
          <p className={`text-[12px] font-bold mt-0.5 ${isWin ? 'text-[var(--success)]' : 'text-[var(--club-red)]'}`}>
            {isWin ? 'Vittoria' : match.result === 'loss' ? 'Sconfitta' : match.result}
          </p>
        </div>
      </div>
    </div>
  );
}

function PendingCard({ profile, busy, onApprove, onReject }: { profile: Profile; busy: boolean; onApprove: () => void; onReject: () => void }) {
  const initial = profile.full_name.charAt(0).toUpperCase();
  const created = new Date(profile.created_at);
  const pendingClassified = isClassified(profile.ranking);
  const pendingAgeCategory = getAgeCategory(profile.birth_date);
  return (
    <div className="card p-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-3.5">
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
            <span className="text-[10px] text-gray-400">· {timeAgo(created)}</span>
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

// ─── Student Detail (mobile, full screen replacement) ──
function StudentDetailMobile({
  student, onBack, onLogout, coachId,
}: { student: Profile; onBack: () => void; onLogout: () => void; coachId: string | null }) {
  const [studentTab, setStudentTab] = useState('obiettivi');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [matches, setMatches] = useState<MatchResultRow[]>([]);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [matchFormOpen, setMatchFormOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<MatchResultRow | null>(null);
  const [coachNotesOpen, setCoachNotesOpen] = useState(false);
  const [coachNotesMatch, setCoachNotesMatch] = useState<MatchResultRow | null>(null);

  const [reloadTick, setReloadTick] = useState(0);
  const refetch = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: g }, { data: m }] = await Promise.all([
        supabase.from('goals').select('*').eq('student_id', student.id).order('sort_order'),
        supabase.from('match_results').select('*').eq('student_id', student.id).order('match_date', { ascending: false }),
      ]);
      if (!cancelled) {
        setGoals((g as Goal[]) || []);
        setMatches((m as MatchResultRow[]) || []);
      }
    })();
    return () => { cancelled = true; };
  }, [student.id, reloadTick]);

  const handleSaveGoal = async (data: Partial<Goal>) => {
    if (editingGoal) {
      await supabase.from('goals').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingGoal.id);
    } else {
      await supabase.from('goals').insert({ ...data, student_id: student.id, created_by: coachId });
    }
    await refetch();
    setEditingGoal(null);
  };
  const handleDeleteGoal = async (id: string) => {
    await supabase.from('goals').delete().eq('id', id);
    await refetch();
  };
  const handleGoalStatusChange = async (id: string, status: GoalStatus) => {
    const updates: Partial<Goal> = { status, updated_at: new Date().toISOString() };
    if (status === 'completed') { updates.progress = 100; updates.completed_at = new Date().toISOString(); }
    if (status === 'planned') { updates.progress = 0; updates.completed_at = null; }
    await supabase.from('goals').update(updates).eq('id', id);
    await refetch();
  };
  const handleGoalProgressChange = async (id: string, progress: number) => {
    await supabase.from('goals').update({ progress, updated_at: new Date().toISOString() }).eq('id', id);
    setGoals((prev) => prev.map((g) => g.id === id ? { ...g, progress } : g));
  };

  const handleSaveMatch = async (data: Partial<MatchResultRow>) => {
    if (editingMatch) {
      await supabase.from('match_results').update(data).eq('id', editingMatch.id);
    } else {
      await supabase.from('match_results').insert({ ...data, student_id: student.id });
    }
    await refetch();
    setEditingMatch(null);
  };
  const handleDeleteMatch = async (id: string) => {
    await supabase.from('match_results').delete().eq('id', id);
    await refetch();
  };
  const handleSaveCoachNotes = async (notes: string) => {
    if (coachNotesMatch) {
      await supabase.from('match_results').update({ coach_notes: notes || null }).eq('id', coachNotesMatch.id);
      await refetch();
    }
  };

  const handleFab = () => {
    if (studentTab === 'obiettivi') { setEditingGoal(null); setGoalFormOpen(true); }
    else { setEditingMatch(null); setMatchFormOpen(true); }
  };

  const { displayLevel, displayRanking } = getDisplayRanking(student);
  const classified = isClassified(displayRanking);
  const ageCategory = getAgeCategory(student.birth_date);
  const wins = matches.filter((m) => m.result === 'win').length;
  const completedGoals = goals.filter((g) => g.status === 'completed').length;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <MobileHeader onLogout={onLogout} />

      <main className="px-4 py-5 pb-28">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[13px] font-medium text-gray-500 hover:text-[var(--club-blue)] mb-5 transition-colors group"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-0.5 transition-transform">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Torna agli allievi
        </button>

        <div className="card p-5 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--club-blue)] to-[var(--club-blue-dark)] flex items-center justify-center text-white text-xl font-bold shadow-sm shrink-0">
              {student.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 tracking-[-0.02em] truncate">{student.full_name}</h2>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ageCategory && (
                  <Badge color="var(--club-blue)" bg="var(--club-blue-light)">{ageCategory}</Badge>
                )}
                {classified ? (
                  <Badge color="var(--club-red)" bg="var(--club-red-light)">FIT: {displayRanking}</Badge>
                ) : (
                  <>
                    <Badge>{displayLevel}</Badge>
                    <Badge color="var(--muted)" bg="#F3F4F6">Non classificato</Badge>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center pt-3 border-t border-gray-100">
            <div>
              <p className="text-base font-bold text-[var(--club-blue)]">{goals.length}</p>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Obiettivi</p>
            </div>
            <div>
              <p className="text-base font-bold text-[var(--success)]">{completedGoals}</p>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Completati</p>
            </div>
            <div>
              <p className="text-base font-bold text-gray-700">{matches.length}</p>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Match</p>
            </div>
            <div>
              <p className="text-base font-bold text-[var(--club-red)]">{wins}</p>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Vittorie</p>
            </div>
          </div>
        </div>

        <Tabs
          tabs={[{ id: 'obiettivi', label: 'Obiettivi' }, { id: 'match', label: 'Match' }]}
          active={studentTab}
          onChange={setStudentTab}
        />

        <div className="mt-4">
          {studentTab === 'obiettivi' && (
            goals.length === 0 ? (
              <EmptyState
                icon="🎯"
                title="Nessun obiettivo"
                message="Crea il primo obiettivo per questo allievo!"
                action={<Button variant="primary" onClick={() => { setEditingGoal(null); setGoalFormOpen(true); }}>Crea obiettivo</Button>}
              />
            ) : (
              <KanbanBoard
                goals={goals}
                isCoach={true}
                onEdit={(g) => { setEditingGoal(g); setGoalFormOpen(true); }}
                onDelete={handleDeleteGoal}
                onStatusChange={handleGoalStatusChange}
                onProgressChange={handleGoalProgressChange}
              />
            )
          )}
          {studentTab === 'match' && (
            matches.length === 0 ? (
              <EmptyState
                icon="🏆"
                title="Nessun match"
                message="Questo allievo non ha ancora registrato match."
                action={<Button variant="primary" onClick={() => { setEditingMatch(null); setMatchFormOpen(true); }}>Aggiungi match</Button>}
              />
            ) : (
              <div className="flex flex-col gap-3 stagger-children">
                {matches.map((m) => (
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
            )
          )}
        </div>
      </main>

      <button
        onClick={handleFab}
        className="fab"
        aria-label={studentTab === 'obiettivi' ? 'Nuovo obiettivo' : 'Aggiungi match'}
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <GoalForm
        open={goalFormOpen}
        onClose={() => { setGoalFormOpen(false); setEditingGoal(null); }}
        onSave={handleSaveGoal}
        goal={editingGoal}
        isCoach={true}
      />
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
    </div>
  );
}
