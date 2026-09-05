'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/lib/hooks';
import { Spinner } from '@/components/UI';
import { AnimatedThemeToggler } from '@/components/ui/AnimatedThemeToggler';
import { PlayerView } from './PlayerView';
import { ProfilePage } from './ProfilePage';

type View = 'main' | 'profile';

export function StudentDashboard() {
  const { user, profile } = useAuth();
  const [view, setView] = useState<View>('main');
  // Il breakpoint e' quello delle classi `sm:` qui sotto, non i 768 di
  // default: l'altezza fissa vale solo dove vale anche `flex-col`.
  const isMobile = useIsMobile(640);

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
    // Su telefono l'altezza e' quella VERA della parte visibile (--app-h,
    // vedi lib/viewport-script.ts); da tablet in su torna a crescere con il
    // contenuto. Lo stile in linea batte qualunque classe, quindi lo si mette
    // solo quando serve: altrimenti vincerebbe anche su `sm:h-auto`.
    <div
      className="sm:h-auto sm:min-h-screen flex sm:block flex-col overflow-hidden sm:overflow-visible bg-[var(--background)]"
      style={isMobile ? { height: 'var(--app-h, 100svh)' } : undefined}
    >
      <header
        className="shrink-0 sm:sticky sm:top-0 sm:z-30 glass border-b border-border"
        style={{ paddingTop: 'var(--safe-top)' }}
      >
        <div className="max-w-7xl mx-auto page-gutter-x">
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

            {/* L'interruttore chiaro/scuro mancava solo qui.

                Ce l'hanno la barra del maestro da scrivania (components/Header)
                e quella da telefono (app/coach/components/MobileHeader): la
                scheda dell'allievo era l'unica schermata da cui il tema non si
                poteva cambiare, e per un allievo e' proprio l'unica barra che
                vede — quindi di fatto il tema scuro non era raggiungibile. */}
            <AnimatedThemeToggler size={36} />
          </div>
        </div>
      </header>
      <div className="club-stripe shrink-0" />

      <main className="max-w-7xl mx-auto page-gutter-x pt-5 w-full flex-1 min-h-0 flex flex-col overflow-hidden sm:block sm:overflow-visible sm:pb-6">
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
