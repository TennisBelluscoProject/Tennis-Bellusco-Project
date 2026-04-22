'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from './UI';

export function Header() {
  const { profile, isCoach, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--club-red)] flex items-center justify-center shadow-sm">
              <span className="text-lg">🎾</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[var(--club-blue)] leading-tight tracking-tight font-[var(--font-display)]">
                Tennis Club Bellusco
              </span>
              <span className="text-[11px] text-gray-400 leading-tight">
                {isCoach ? 'Dashboard Maestro' : `Ciao, ${profile?.first_name || profile?.full_name}!`}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hidden sm:inline">Esci</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
