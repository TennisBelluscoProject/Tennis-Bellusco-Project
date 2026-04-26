'use client';

import { useMemo } from 'react';
import { Spinner, EmptyState } from '@/components/UI';
import type { Goal, MatchResultRow, Profile } from '@/lib/database.types';
import { isActiveToday, formatDateLong } from '@/lib/utils';
import { StatPill, FilterPill } from '../components/Pills';
import { NotificationCard, type Notif } from '../components/NotificationCard';

interface Props {
  loading: boolean;
  students: Profile[];
  studentActivity: Record<string, Date | null>;
  recentGoals: Goal[];
  allMatches: MatchResultRow[];
  notifFilter: 'all' | 'goal' | 'match';
  onNotifFilterChange: (f: 'all' | 'goal' | 'match') => void;
  dismissed: Set<string>;
  onDismissOne: (id: string) => void;
  onDismissAll: () => void;
}

function IconUsersTiny() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  );
}

export function HomeTab({
  loading,
  students,
  studentActivity,
  recentGoals,
  allMatches,
  notifFilter,
  onNotifFilterChange,
  dismissed,
  onDismissOne,
  onDismissAll,
}: Props) {
  const totalStudents = students.length;
  const activeGoals = recentGoals.filter(
    (g) => g.status !== 'completed' && students.some((s) => s.id === g.student_id)
  ).length;
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

  const activeToday = students.filter((s) => isActiveToday(studentActivity[s.id] ?? null)).length;

  // Notifications feed (derived from data)
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

  return (
    <div className="px-4 py-5 animate-fade-in">
      {/* Greeting */}
      <div className="mb-5">
        <h2
          className="text-2xl font-bold text-gray-900 tracking-[-0.02em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Benvenuto
        </h2>
        <p className="text-sm text-[var(--club-blue)] mt-1">
          {formatDateLong(new Date())} · {activeToday} {activeToday === 1 ? 'allievo attivo' : 'allievi attivi'} oggi
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatPill label="Allievi" value={totalStudents} icon={<IconUsersTiny />} accent="var(--club-blue)" />
        <StatPill label="Obiettivi attivi" value={activeGoals} icon={<span>🎯</span>} accent="#E65100" />
        <StatPill label="Win Rate" value={`${winRate}%`} icon={<span>🏆</span>} accent="var(--success)" valueColor="var(--success)" />
        <StatPill label="Match mese" value={matchesThisMonth} icon={<span>📅</span>} accent="var(--club-red)" valueColor="var(--club-red)" />
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
            onClick={onDismissAll}
            className="text-[12px] font-medium text-gray-500 hover:text-[var(--club-red)] transition-colors"
          >
            Cancella tutto
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto -mx-4 px-4 pb-1">
        <FilterPill active={notifFilter === 'all'} onClick={() => onNotifFilterChange('all')} label="Tutte" count={notifications.length} />
        <FilterPill active={notifFilter === 'goal'} onClick={() => onNotifFilterChange('goal')} label="Obiettivi" count={goalNotifsCount} />
        <FilterPill active={notifFilter === 'match'} onClick={() => onNotifFilterChange('match')} label="Match" count={matchNotifsCount} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filteredNotifs.length === 0 ? (
        <EmptyState icon="🔔" title="Nessuna notifica" message="Le attività degli allievi appariranno qui." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredNotifs.map((n) => (
            <NotificationCard key={n.id} notif={n} onDismiss={() => onDismissOne(n.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
