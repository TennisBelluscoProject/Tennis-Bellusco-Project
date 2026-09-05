'use client';

import { useId, type ReactNode } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────────────────
   Schede.

   L'indicatore e' un solo elemento condiviso (`layoutId`): scivola dalla
   scheda vecchia alla nuova invece di sparire e ricomparire. E' quel
   movimento a rendere leggibile lo spostamento — senza, il cambio scheda e'
   un taglio secco e l'occhio deve ritrovare da solo dov'e' finito il fuoco.
   ───────────────────────────────────────────────────────────────────────── */

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  /** Colore dell'accento quando la scheda e' attiva. */
  color?: string;
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

/** Schede con filetto in basso: la barra principale delle sezioni. */
export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  const group = useId();
  return (
    <LayoutGroup id={group}>
      <div
        role="tablist"
        className={cn(
          'flex border-b border-border overflow-x-auto scrollbar-hidden -mb-px',
          className
        )}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex items-center gap-1.5 px-4 py-3 text-[13px] font-semibold whitespace-nowrap shrink-0',
                'transition-colors duration-[var(--dur-base)]',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.icon}
              {tab.label}
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={cn(
                    'text-[10px] font-bold tnum rounded-full px-1.5 py-0.5 leading-none min-w-[17px] text-center transition-colors',
                    isActive ? 'bg-primary text-[var(--primary-foreground)]' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {tab.count}
                </span>
              )}
              {isActive && (
                <motion.span
                  layoutId="tab-underline"
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Selettore di SEZIONE.

   Le pastiglie piccole allineate a sinistra dicevano la cosa sbagliata: sono
   la stessa forma dei filtri, quindi si leggevano come "restringi questa
   lista" invece che "vai in un'altra parte dell'app" — e infatti le due cose
   convivevano nella stessa schermata con lo stesso aspetto.

   Qui le voci sono parti alternative, e la forma lo deve dire da sola: UNA
   pista sola che occupa tutta la larghezza, divisa in parti uguali, con
   dentro un unico indicatore pieno che si sposta. Uno spazio chiuso e diviso
   si legge come "scegli dove stare"; delle pastiglie sparse su un fondo
   aperto no — e quante siano si vede subito, senza contarle.

   L'indicatore e' pieno e non un rialzo bianco: e' la voce attiva a dover
   pesare piu' delle altre, non il contrario.
   ───────────────────────────────────────────────────────────────────────── */

export function SectionSwitcher({ tabs, active, onChange, className }: TabsProps) {
  const group = useId();
  return (
    <LayoutGroup id={group}>
      <div
        role="tablist"
        className={cn(
          'flex w-full gap-1 rounded-[var(--radius-lg)] border border-border-soft bg-[var(--sunken)] p-1',
          className
        )}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const accent = tab.color ?? 'var(--primary)';
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex min-w-0 flex-1 items-center justify-center gap-1.5',
                'rounded-[var(--radius-md)] px-2 py-2.5 text-[13px] font-semibold'
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="section-indicator"
                  transition={{ type: 'spring', stiffness: 480, damping: 40 }}
                  // Il velo scuro vale SOLO a tema scuro. Li' gli accenti della
                  // palette sono schiariti apposta per restare leggibili COME
                  // TESTO su fondo scuro; usati al contrario, come riempimento
                  // sotto una scritta bianca, scendono sotto 3:1. Il velo li
                  // riporta alla profondita' che serve a un fondo senza toccare
                  // la palette e senza cambiare il colore della sezione.
                  className={cn(
                    'absolute inset-0 rounded-[var(--radius-md)] shadow-[var(--shadow-sm)]',
                    'dark:bg-gradient-to-b dark:from-black/30 dark:to-black/30'
                  )}
                  style={{ backgroundColor: accent }}
                />
              )}
              <span
                className={cn(
                  'relative z-10 truncate transition-colors duration-[var(--dur-base)]',
                  isActive
                    ? 'text-[var(--primary-foreground)]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className="tnum relative z-10 min-w-[17px] shrink-0 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none"
                  style={
                    isActive
                      ? { backgroundColor: 'rgba(255, 255, 255, 0.24)', color: 'var(--primary-foreground)' }
                      : { backgroundColor: 'var(--secondary)', color: 'var(--muted-foreground)' }
                  }
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/**
 * Controllo segmentato: la "pillola" scorre sotto la voce scelta.
 * Si usa dove le opzioni sono poche e vanno viste tutte insieme (gli stati
 * del Kanban su telefono, i filtri).
 */
export function SegmentedControl({
  tabs,
  active,
  onChange,
  className,
}: TabsProps) {
  const group = useId();
  return (
    <LayoutGroup id={group}>
      <div
        role="tablist"
        className={cn(
          'flex gap-1 p-1 rounded-[var(--radius-lg)] bg-muted border border-border-soft',
          className
        )}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const accent = tab.color ?? 'var(--primary)';
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className="relative flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2 rounded-[var(--radius-md)] text-[12.5px] font-semibold"
            >
              {isActive && (
                <motion.span
                  layoutId="segment-pill"
                  transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                  className="absolute inset-0 rounded-[var(--radius-md)] bg-card shadow-[var(--shadow-sm)]"
                />
              )}
              <span
                className={cn(
                  'relative z-10 truncate transition-colors duration-[var(--dur-base)]',
                  !isActive && 'text-muted-foreground'
                )}
                style={isActive ? { color: accent } : undefined}
              >
                {tab.label}
              </span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className="relative z-10 text-[10px] font-bold tnum rounded-full px-1.5 py-0.5 leading-none min-w-[17px] text-center transition-colors"
                  style={
                    isActive
                      ? { backgroundColor: accent, color: 'var(--primary-foreground)' }
                      : { backgroundColor: 'var(--secondary)', color: 'var(--muted-foreground)' }
                  }
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
