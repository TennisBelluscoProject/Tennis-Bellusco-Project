'use client';

import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { IconButton } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

/**
 * La barra in alto.
 *
 * Sostituisce il logo raster e la fascia tricolore: adesso c'e' il marchio
 * vettoriale (che regge lo schermo scuro senza un secondo file) e una riga
 * sottile di separazione. Il saluto sta sotto al nome del club su schermo
 * largo e sparisce da telefono, dove quei pixel servono al contenuto.
 */
export function Header() {
  const { profile, isCoach, signOut } = useAuth();

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const greeting = isCoach
    ? 'Dashboard maestro'
    : `Ciao, ${profile?.first_name || profile?.full_name || ''}`;

  return (
    // `viewportFit: cover` (in layout.tsx) fa arrivare la pagina fin sotto la
    // tacca e la barra di stato: e' quello che permette allo sfondo di andare
    // davvero a filo, ma vuol dire che il contenuto ci finisce sotto se
    // nessuno se ne occupa. Il rientro lo mette la barra, che e' il primo
    // elemento della pagina; il resto sta sotto di lei e non deve fare niente.
    <header
      className="sticky top-0 z-40 glass border-b border-border"
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-[var(--header-h)]">
          <div className="flex items-center gap-3 min-w-0">
            <Logo size={30} />
            <span className="hidden sm:block h-5 w-px bg-border shrink-0" aria-hidden />
            <span className="hidden sm:block text-[12.5px] text-muted-foreground truncate">
              {greeting}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />

            <span
              className="w-8 h-8 rounded-[var(--radius-sm)] bg-primary-soft flex items-center justify-center shrink-0"
              title={profile?.full_name ?? undefined}
            >
              <span className="text-[11px] font-bold text-primary tracking-wide">{initials}</span>
            </span>

            <IconButton
              label="Esci"
              onClick={signOut}
              icon={<LogOut size={16} />}
              className="hover:text-destructive hover:bg-destructive-soft"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
