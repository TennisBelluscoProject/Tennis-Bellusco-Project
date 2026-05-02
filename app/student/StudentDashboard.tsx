'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/UI';
import { PlayerView } from './PlayerView';
import { ProfilePage } from './ProfilePage';

type View = 'main' | 'profile';

export function StudentDashboard() {
  const { user, profile } = useAuth();
  const [view, setView] = useState<View>('main');

  if (!profile || !user) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-[var(--background)]">
        <Spinner size={32} />
      </div>
    );
  }

  if (view === 'profile') {
    return <ProfilePage onBack={() => setView('main')} />;
  }

  return (
    <div className="h-[100dvh] sm:h-auto sm:min-h-screen flex sm:block flex-col overflow-hidden sm:overflow-visible bg-[var(--background)]">
      <header className="shrink-0 sm:sticky sm:top-0 sm:z-30 bg-white/98 backdrop-blur-lg border-b border-gray-100/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--club-red)] flex items-center justify-center shadow-sm relative overflow-hidden">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative z-10">
                  <circle cx="13" cy="9" r="7" />
                  <path d="M9.7 14.3L3 21" />
                  <path d="M6 9h14" />
                  <path d="M13 2v14" />
                </svg>
                <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent" />
              </div>
              <span
                className="text-[14px] sm:text-[15px] font-bold text-[var(--club-blue)] leading-tight tracking-[-0.01em]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Tennis Club Bellusco
              </span>
            </div>
          </div>
        </div>
      </header>
      <div className="club-stripe shrink-0" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 w-full flex-1 min-h-0 flex flex-col overflow-hidden sm:block sm:overflow-visible sm:pb-6">
        <PlayerView
          player={profile}
          mode="self"
          writerId={user.id}
          onEditProfile={() => setView('profile')}
        />
      </main>
    </div>
  );
}
