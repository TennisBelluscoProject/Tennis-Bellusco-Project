'use client';

import { Users } from 'lucide-react';
import type { Profile } from '@/lib/database.types';

interface Props {
  group: Profile;
  /** Quanti partecipanti ha il gruppo. */
  members: number;
  /** Obiettivi non conclusi del gruppo. */
  openGoals: number;
  onClick: () => void;
}

/**
 * Riga di un gruppo nella lista del maestro.
 *
 * Volutamente diversa da `StudentRow`: niente avatar, niente categoria d'eta',
 * niente classifica FIT. Un gruppo non ha quei dati, e mostrarli vuoti
 * suggerirebbe che siano solo da compilare. Al loro posto le due cose che
 * contano davvero: quanti sono e quanto lavoro hanno aperto.
 */
export function GroupRow({ group, members, openGoals, onClick }: Props) {
  return (
    <button onClick={onClick} className="card card-interactive p-4 text-left flex items-center gap-3.5">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-sm"
        style={{
          background:
            'linear-gradient(135deg, var(--club-red) 0%, var(--club-red-dark, #8E1B1B) 100%)',
        }}
      >
        <Users size={22} strokeWidth={2.2} />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-bold text-foreground tracking-[-0.01em] truncate">
          {group.full_name}
        </h3>
        <p className="text-[11px] text-muted-foreground mt-1">
          {members} {members === 1 ? 'partecipante' : 'partecipanti'}
          {openGoals > 0 && (
            <>
              {' '}·{' '}
              <span className="text-[var(--club-blue)] font-bold">
                {openGoals} {openGoals === 1 ? 'obiettivo aperto' : 'obiettivi aperti'}
              </span>
            </>
          )}
        </p>
      </div>

      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="shrink-0 text-[var(--subtle-foreground)]"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
