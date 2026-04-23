'use client';

import { useAuth } from '@/contexts/AuthContext';

export function Header() {
  const { profile, isCoach, signOut } = useAuth();

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/98 backdrop-blur-lg border-b border-gray-100/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--club-red)] flex items-center justify-center shadow-sm relative overflow-hidden">
                <span className="text-xl relative z-10">🎾</span>
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
              </div>
              <div className="flex flex-col">
                <span
                  className="text-[15px] font-bold text-[var(--club-blue)] leading-tight tracking-[-0.01em]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Tennis Club Bellusco
                </span>
                <span className="text-[11px] text-[var(--muted)] leading-tight mt-0.5">
                  {isCoach ? 'Dashboard Maestro' : `Ciao, ${profile?.first_name || profile?.full_name}!`}
                </span>
              </div>
            </div>

            {/* User + Logout */}
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-lg bg-[var(--club-blue-light)] flex items-center justify-center">
                <span className="text-[11px] font-bold text-[var(--club-blue)] tracking-wide">
                  {initials}
                </span>
              </div>

              {/* Logout */}
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] text-[var(--muted)] hover:text-[var(--club-red)] hover:bg-[var(--club-red-light)] transition-all duration-200"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span className="hidden sm:inline font-medium">Esci</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      {/* Tricolor stripe */}
      <div className="club-stripe" />
    </>
  );
}
