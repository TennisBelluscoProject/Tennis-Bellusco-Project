'use client';

import { motion } from 'motion/react';
import { BookOpen, House, Trophy, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CoachTabId = 'home' | 'allievi' | 'catalogo' | 'risultati' | 'richieste';

interface Props {
  active: CoachTabId;
  onChange: (tab: CoachTabId) => void;
  pendingCount: number;
}

const ITEMS: { id: CoachTabId; label: string; Icon: LucideIcon }[] = [
  { id: 'home', label: 'Home', Icon: House },
  { id: 'allievi', label: 'Allievi', Icon: Users },
  { id: 'catalogo', label: 'Catalogo', Icon: BookOpen },
  { id: 'risultati', label: 'Risultati', Icon: Trophy },
  { id: 'richieste', label: 'Richieste', Icon: UserPlus },
];

/** Una sola molla per tutto: pastiglia che scorre, voci che si allargano. */
const SPRING = { type: 'spring' as const, stiffness: 520, damping: 42, mass: 0.6 };

/* ═════════════════════════════════════════════════════════════════════════
   La barra di navigazione del maestro.

   Un "dock" che galleggia sul fondo pagina invece di una fascia attaccata al
   bordo. Solo la voce attiva porta l'etichetta: le altre restano icone, cosi'
   cinque voci stanno larghe anche su uno schermo da 375px e la barra non
   diventa una fila di scritte piccole.

   Il movimento e' una cosa sola: la pastiglia scorre da una voce all'altra
   (`layoutId`) mentre le voci si allargano e si stringono (`layout`). Sono due
   animazioni della stessa passata di layout di motion, quindi partono insieme
   e non si rincorrono.

   STA NEL FLUSSO, non e' `fixed`: e' l'ultima riga della colonna alta quanto
   il viewport (CoachMobileDashboard). Da `fixed` si ancorava al viewport di
   layout e finiva sotto al bordo dello schermo, lasciando una striscia di
   sfondo che spariva solo scorrendo.
   ═════════════════════════════════════════════════════════════════════════ */

export function BottomNav({ active, onChange, pendingCount }: Props) {
  return (
    // La barra DIPINGE il rientro di sistema invece di lasciarlo trasparente.
    //
    // Prima era una pastiglia che galleggiava, con il fondo pagina tutto
    // intorno: sotto restava sempre una striscia grigia alta quanto la barra
    // dei gesti, e a schermo sembrava spazio sprecato. Ora e' un foglio
    // agganciato al bordo, arrotondato solo in cima, e il rientro sta DENTRO
    // il suo sfondo: sotto non c'e' piu' niente da vedere.
    <nav
      className="shrink-0 rounded-t-[26px] border-t border-border-soft bg-card px-2 pt-2"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-between gap-1">
        {ITEMS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          const showBadge = id === 'richieste' && pendingCount > 0;

          return (
            <motion.button
              key={id}
              layout
              transition={SPRING}
              onClick={() => onChange(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              // Il padding si stringe sotto i 360px: con "Richieste" aperta
              // (l'etichetta piu' lunga) cinque voci non ci stavano su uno
              // schermo da 320, e il dock andava in overflow.
              className={cn(
                'relative flex h-10 items-center justify-center rounded-full',
                isActive ? 'px-3 min-[360px]:px-3.5' : 'px-2 min-[360px]:px-3'
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="coach-nav-pill"
                  transition={SPRING}
                  className="absolute inset-0 rounded-full bg-[var(--primary)]"
                  style={{ boxShadow: 'var(--shadow-primary)' }}
                />
              )}

              <span
                className="relative z-10 flex items-center gap-1.5"
                style={{ color: isActive ? 'var(--primary-foreground)' : 'var(--muted-foreground)' }}
              >
                <span className="relative flex">
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                  {showBadge && (
                    <span
                      className={cn(
                        'absolute -right-1.5 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums',
                        isActive
                          ? 'bg-[var(--primary-foreground)] text-[var(--primary)]'
                          : 'bg-[var(--destructive)] text-[var(--destructive-foreground)]'
                      )}
                    >
                      {pendingCount}
                    </span>
                  )}
                </span>

                {/* Solo l'etichetta attiva. Sparisce smontandosi: la larghezza
                    del bottone la riassorbe `layout`, quindi non serve
                    un'uscita animata che terrebbe la voce larga a meta' strada. */}
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="whitespace-nowrap text-[13px] font-semibold tracking-[-0.01em]"
                  >
                    {label}
                  </motion.span>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
