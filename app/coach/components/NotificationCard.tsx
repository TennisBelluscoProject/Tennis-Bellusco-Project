'use client';

import { timeAgo } from '@/lib/utils';

export type NotifKind = 'goal' | 'match';
export interface Notif {
  id: string;
  kind: NotifKind;
  studentName: string;
  title: string;
  subtitle: string;
  date: Date;
}

interface Props {
  notif: Notif;
  onDismiss: () => void;
}

export function NotificationCard({ notif, onDismiss }: Props) {
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
