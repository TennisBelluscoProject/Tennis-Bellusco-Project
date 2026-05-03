'use client';

import { useState } from 'react';
import Image from 'next/image';
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
              <Image
                src="/logo-header.png"
                alt="Tennis Bellusco 2012"
                width={73}
                height={36}
                priority
                className="object-contain"
              />
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
