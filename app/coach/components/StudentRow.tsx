'use client';

import { Badge } from '@/components/UI';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import type { Profile } from '@/lib/database.types';
import { getDisplayRanking, getAgeCategory, isClassified } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';

interface Props {
  student: Profile;
  dot: { color: string; bg: string; label: string };
  stats: { matches: number; wins: number; goals: number };
  lastActivity: Date | null;
  onClick: () => void;
}

export function StudentRow({ student, dot, stats, lastActivity, onClick }: Props) {
  const { displayLevel, displayRanking } = getDisplayRanking(student);
  const initial = student.full_name.charAt(0).toUpperCase();
  const winPct = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
  const classified = isClassified(displayRanking);
  const ageCategory = getAgeCategory(student.birth_date);

  return (
    <button onClick={onClick} className="card card-interactive p-4 text-left flex items-center gap-3.5">
      <AvatarDisplay photoUrl={student.photo_url} fullName={student.full_name} size={48} />
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-bold text-gray-900 tracking-[-0.01em] truncate">{student.full_name}</h3>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {ageCategory && <Badge color="var(--club-blue)" bg="var(--club-blue-light)">{ageCategory}</Badge>}
          {classified ? (
            <span className="text-[11px] font-semibold text-[var(--club-red)]">FIT: {displayRanking}</span>
          ) : (
            <Badge>{displayLevel}</Badge>
          )}
        </div>
        <p className="text-[11px] text-gray-500 mt-1">
          {stats.matches} match
          {stats.matches > 0 && (
            <>
              {' '}· <span className="text-[var(--success)] font-bold">{winPct}% vinte</span>
            </>
          )}
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
