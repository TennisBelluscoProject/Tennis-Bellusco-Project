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
    <div className="h-[100dvh] sm:h-screen overflow-hidden flex flex-col bg-[var(--background)]">
      {/* Compact header — no avatar, no name (already in main card) */}
      <header className="shrink-0 bg-white/98 backdrop-blur-lg border-b border-gray-100/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--club-red)] flex items-center justify-center shadow-sm relative overflow-hidden">
                <span className="text-lg relative z-10">🎾</span>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 w-full flex-1 min-h-0 flex flex-col overflow-hidden">
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
