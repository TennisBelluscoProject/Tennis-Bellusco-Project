'use client';

import { cn } from '@/lib/utils';

interface FilterPillProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}

/**
 * Pastiglia di filtro.
 *
 * `shrink-0`: vive dentro una riga che scorre in orizzontale, e senza di
 * questo le pastiglie si schiacciavano invece di uscire dal bordo.
 */
export function FilterPill({ active, onClick, label, count }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5',
        'text-[13px] font-semibold transition-colors duration-[var(--dur-base)]',
        active
          ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
          : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]'
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          'tnum rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
          active
            ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
            : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
        )}
      >
        {count}
      </span>
    </button>
  );
}
