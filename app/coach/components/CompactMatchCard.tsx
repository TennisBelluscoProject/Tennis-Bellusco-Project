'use client';

import type { MatchResultRow } from '@/lib/database.types';

interface Props {
  match: MatchResultRow;
}

export function CompactMatchCard({ match }: Props) {
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
