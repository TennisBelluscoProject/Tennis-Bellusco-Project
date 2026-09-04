'use client';

import { useMemo, type ReactNode } from 'react';
import { BellOff, Target, Users } from 'lucide-react';
import { Spinner, EmptyState } from '@/components/UI';
import type { Goal, MatchResultRow, Profile } from '@/lib/database.types';
import { isActiveToday, formatDateLong } from '@/lib/utils';
import { FilterPill } from '../components/Pills';
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

/* ═════════════════════════════════════════════════════════════════════════
   La schermata di apertura del maestro.

   Due soli numeri: quanti allievi e quanti obiettivi sono ancora aperti. Win
   rate e match del mese erano due percentuali che nessuno guardava e che
   rubavano meta' della prima schermata alle notifiche, che sono la ragione
   vera per cui si apre l'app.

   I due numeri stanno in UN blocco diviso a meta', non in due riquadri
   staccati: sono la stessa lettura ("com'e' messo il gruppo adesso"), e un
   riquadro per numero li faceva sembrare due sezioni diverse.
   ═════════════════════════════════════════════════════════════════════════ */

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
    <div className="flex h-full flex-col animate-fade-in">
      <div className="shrink-0 px-4 pt-4 pb-3">
        {/* Intestazione */}
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--subtle-foreground)]">
          {formatDateLong(new Date())}
        </p>
        <h2 className="mt-1 text-[26px] font-bold leading-none tracking-[-0.03em] text-[var(--foreground)]">
          Benvenuto
        </h2>

        {/* Riepilogo: i due numeri che contano */}
        <div className="card mt-4 overflow-hidden">
          <div className="flex">
            <SummaryStat
              icon={<Users size={15} strokeWidth={2.4} />}
              value={totalStudents}
              label="Allievi"
              accent="var(--primary)"
            />
            <div className="w-px self-stretch bg-[var(--border-soft)]" aria-hidden />
            <SummaryStat
              icon={<Target size={15} strokeWidth={2.4} />}
              value={activeGoals}
              label="Obiettivi attivi"
              accent="var(--cat-agonismo)"
            />
          </div>

          <div className="flex items-center gap-2 border-t border-[var(--border-soft)] bg-[var(--sunken)] px-4 py-2.5">
            <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
              <span className="animate-pulse-soft absolute inset-0 rounded-full bg-[var(--success)]" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
            </span>
            <span className="text-[12px] text-[var(--muted-foreground)]">
              {activeToday} {activeToday === 1 ? 'allievo attivo' : 'allievi attivi'} oggi
            </span>
          </div>
        </div>

        {/* Notifiche */}
        <div className="mt-5 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold tracking-[-0.01em] text-[var(--foreground)]">
              Notifiche
            </h3>
            {notifications.length > 0 && (
              <span className="rounded-full bg-[var(--destructive)] px-2 py-0.5 text-[10px] font-bold text-[var(--destructive-foreground)]">
                {notifications.length} {notifications.length === 1 ? 'nuova' : 'nuove'}
              </span>
            )}
          </div>
          {notifications.length > 0 && (
            <button
              onClick={onDismissAll}
              className="text-[12px] font-medium text-[var(--muted-foreground)] transition-colors duration-[var(--dur-base)] hover:text-[var(--destructive)]"
            >
              Cancella tutto
            </button>
          )}
        </div>

        <div className="scrollbar-hidden -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <FilterPill active={notifFilter === 'all'} onClick={() => onNotifFilterChange('all')} label="Tutte" count={notifications.length} />
          <FilterPill active={notifFilter === 'goal'} onClick={() => onNotifFilterChange('goal')} label="Obiettivi" count={goalNotifsCount} />
          <FilterPill active={notifFilter === 'match'} onClick={() => onNotifFilterChange('match')} label="Match" count={matchNotifsCount} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filteredNotifs.length === 0 ? (
          <EmptyState icon={<BellOff size={40} strokeWidth={1.5} />} title="Nessuna notifica" message="Le attività degli allievi appariranno qui." />
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredNotifs.map((n) => (
              <NotificationCard key={n.id} notif={n} onDismiss={() => onDismissOne(n.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryStat({
  icon,
  value,
  label,
  accent,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  accent: string;
}) {
  return (
    <div className="flex-1 px-4 py-3.5">
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)]"
        style={{
          backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
          color: accent,
        }}
        aria-hidden
      >
        {icon}
      </span>
      <p className="tnum mt-2 text-[28px] font-bold leading-none tracking-[-0.03em] text-[var(--foreground)]">
        {value}
      </p>
      <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--subtle-foreground)]">
        {label}
      </p>
    </div>
  );
}
