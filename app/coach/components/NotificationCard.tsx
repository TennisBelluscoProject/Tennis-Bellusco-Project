'use client';

import { CircleCheckBig, Trophy, X, type LucideIcon } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';

export type NotifKind = 'goal' | 'match';
export interface Notif {
  id: string;
  kind: NotifKind;
  studentName: string;
  title: string;
  subtitle: string;
  date: Date;
}

interface Props {
  notif: Notif;
  onDismiss: () => void;
}

/* ─────────────────────────────────────────────────────────────────────────
   Una riga del centro notifiche.

   Il colore lo porta SOLO la piastrella dell'icona. La versione precedente
   tingeva di verde tutta la card degli obiettivi: con dieci obiettivi
   completati la schermata diventava un muro verde in cui non si distingueva
   piu' una notifica dall'altra, ed era anche l'unica card dell'app con lo
   sfondo colorato. Ora la superficie e' quella di ogni altra card e a
   cambiare e' un quadrato di quaranta punti: si riconosce al volo il tipo,
   senza che l'elenco perda ritmo.

   I colori escono tutti dai token: quelli scritti a mano di prima (#dcfce7,
   text-gray-900) non avevano una controparte scura, e a tema scuro il testo
   nero finiva su fondo scuro — la card era di fatto illeggibile.
   ───────────────────────────────────────────────────────────────────────── */

const KIND: Record<NotifKind, { accent: string; Icon: LucideIcon }> = {
  goal: { accent: 'var(--success)', Icon: CircleCheckBig },
  match: { accent: 'var(--cat-agonismo)', Icon: Trophy },
};

export function NotificationCard({ notif, onDismiss }: Props) {
  const { accent, Icon } = KIND[notif.kind];

  return (
    <figure
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-xl)] p-3.5',
        'border border-[var(--border-soft)] bg-[var(--card)] shadow-[var(--shadow-xs)]',
        // Niente `transform` qui dentro: la card e' anche un elemento animato
        // da motion, che scrive la transform in linea a ogni fotogramma.
        'transition-[box-shadow,border-color] duration-[var(--dur-base)] ease-[var(--ease-out-quint)]',
        'hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]',
        // Al buio un filo di luce dentro il bordo alto da' spessore alla card
        // senza schiarire la superficie.
        'dark:[box-shadow:0_-24px_64px_-24px_rgba(255,255,255,0.09)_inset,var(--shadow-xs)]'
      )}
    >
      {/* Alone del colore del tipo, appoggiato all'angolo dell'icona. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(140px 70px at 0% 0%, color-mix(in srgb, ${accent} 10%, transparent), transparent 72%)`,
        }}
      />

      <div className="relative flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)]"
          style={{
            backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
            color: accent,
          }}
        >
          <Icon size={18} strokeWidth={2.4} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <figcaption
              className="truncate text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ color: accent }}
            >
              {notif.title}
            </figcaption>
            <span className="tnum ml-auto shrink-0 text-[10px] font-medium text-[var(--subtle-foreground)]">
              {timeAgo(notif.date)}
            </span>
            <button
              onClick={onDismiss}
              aria-label={`Cancella la notifica di ${notif.studentName}`}
              className={cn(
                '-mr-0.5 -mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                'text-[var(--subtle-foreground)] transition-colors duration-[var(--dur-fast)]',
                'hover:bg-[var(--secondary)] hover:text-[var(--foreground)] active:bg-[var(--secondary-hover)]'
              )}
            >
              <X size={13} strokeWidth={2.6} />
            </button>
          </div>

          <p className="mt-1 truncate text-[15px] font-bold leading-tight tracking-[-0.01em] text-[var(--foreground)]">
            {notif.studentName}
          </p>
          <p className="mt-0.5 truncate text-[12.5px] leading-snug text-[var(--muted-foreground)]">
            {notif.subtitle}
          </p>
        </div>
      </div>
    </figure>
  );
}
