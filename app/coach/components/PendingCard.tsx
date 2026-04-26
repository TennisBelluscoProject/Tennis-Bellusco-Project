'use client';

import { Badge } from '@/components/UI';
import type { Profile } from '@/lib/database.types';
import { getAgeCategory, isClassified } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';

interface Props {
  profile: Profile;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  /** Compact = mobile, regular = desktop */
  variant?: 'mobile' | 'desktop';
}

export function PendingCard({ profile, busy, onApprove, onReject, variant = 'mobile' }: Props) {
  const initial = profile.full_name.charAt(0).toUpperCase();
  const created = new Date(profile.created_at);
  const classified = isClassified(profile.ranking);
  const ageCategory = getAgeCategory(profile.birth_date);

  return (
    <div className={`card animate-fade-in ${variant === 'desktop' ? 'p-5' : 'p-4'}`}>
      <div className={`flex items-center gap-3${variant === 'desktop' ? '.5' : ''} mb-${variant === 'desktop' ? '4' : '3.5'}`}>
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--club-blue)] to-[var(--club-blue-dark)] flex items-center justify-center text-white text-base font-bold shadow-sm shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-gray-900 tracking-[-0.01em] truncate">{profile.full_name}</h3>
          <p className="text-[12px] text-[var(--club-blue)] truncate">{profile.email}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {ageCategory && <Badge color="var(--club-blue)" bg="var(--club-blue-light)">{ageCategory}</Badge>}
            {classified ? (
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
