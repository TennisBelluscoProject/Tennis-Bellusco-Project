'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { motion, useInView, useMotionValue, useSpring, useTransform } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogoMark } from '@/components/Logo';

/* ─── Badge ─── */

interface BadgeProps {
  children: ReactNode;
  /** Colore del testo. Accetta anche una var CSS, cosi' segue il tema. */
  color?: string;
  /** Sfondo. */
  bg?: string;
  className?: string;
  /** Contorno invece del riempimento. */
  outline?: boolean;
}

export function Badge({ children, color, bg, className, outline }: BadgeProps) {
  const fg = color ?? 'var(--muted-foreground)';
  return (
    <span
      className={cn('badge', className)}
      style={{
        color: fg,
        backgroundColor: outline ? 'transparent' : bg ?? 'var(--muted)',
        border: outline ? `1px solid ${fg}` : undefined,
      }}
    >
      {children}
    </span>
  );
}

/* ─── Barra di progresso ─── */

interface ProgressBarProps {
  value: number;
  color?: string;
  height?: number;
  className?: string;
}

export function ProgressBar({
  value,
  color = 'var(--primary)',
  height = 6,
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('progress-track w-full', className)} style={{ height }}>
      {/* Si anima `scaleX`, non `width`.

          La larghezza e' una proprieta' di layout: cambiarla obbliga il
          browser a ricalcolare la disposizione e a ridisegnare a OGNI
          fotogramma, per ogni barra visibile. `scaleX` invece la applica il
          compositore sulla scheda grafica, senza toccare ne' layout ne'
          disegno — ed e' la differenza fra scattare e scorrere liscio quando
          a schermo ci sono venti obiettivi. */}
      <motion.div
        className="h-full w-full rounded-full"
        style={{ backgroundColor: color, transformOrigin: 'left center' }}
        initial={false}
        animate={{ scaleX: pct / 100 }}
        transition={{ type: 'spring', stiffness: 200, damping: 28 }}
      />
    </div>
  );
}

/* ─── Numero che conta ─── */

/**
 * Un numero che sale fino al proprio valore quando entra in vista.
 * Le statistiche cosi' si notano; scritte di colpo passerebbero inosservate.
 */
export function AnimatedNumber({
  value,
  suffix = '',
  className,
  style,
}: {
  value: number;
  suffix?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 22 });
  const text = useTransform(spring, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, value, mv]);

  return (
    <motion.span ref={ref} className={cn('tnum', className)} style={style}>
      {text}
    </motion.span>
  );
}

/* ─── Statistica ─── */

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
  className?: string;
}

export function StatCard({ label, value, icon, color = 'var(--primary)', className }: StatCardProps) {
  return (
    <div
      className={cn('card stat-card p-4', className)}
      style={{ '--stat-accent': color } as CSSProperties}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-subtle-foreground uppercase tracking-[0.08em]">
          {label}
        </span>
        {icon && <span style={{ color }}>{icon}</span>}
      </div>
      <p className="text-[24px] font-bold tracking-[-0.03em] tnum" style={{ color }}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </p>
    </div>
  );
}

/* ─── Attesa ─── */

export function Spinner({ size = 22, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn('animate-spin text-primary', className)} />;
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn('skeleton', className)} style={style} />;
}

/** Scheletro di una lista di card: si usa al posto dello spinner nelle liste. */
export function SkeletonList({ rows = 3, height = 84 }: { rows?: number; height?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className="rounded-[var(--radius-lg)]"
          style={{ height, opacity: 1 - i * 0.14 }}
        />
      ))}
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[100svh] bg-background">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <LogoMark size={54} animated />
        </motion.div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Stato vuoto ─── */

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, message, action, compact }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex flex-col items-center justify-center text-center px-4',
        compact ? 'py-10' : 'py-16'
      )}
    >
      {/* L'ICONA E BASTA, senza il riquadro dietro.

          Prima stava dentro un quadrato grigio arrotondato di 64px. Quel
          quadrato non diceva niente: non e' un pulsante, non e' un avatar, non
          si puo' premere — era solo una macchia che rubava l'occhio all'icona
          che doveva contenere, e che nei molti stati vuoti dell'app si
          ripeteva identica come un francobollo appiccicato sopra ogni pagina.

          Resta il segno che conta: il tratto dell'icona, nel grigio dei testi
          secondari, cosi' che icona, titolo e messaggio si leggano come una
          cosa sola invece che come un oggetto piu' due righe. Il respiro che
          dava il riquadro lo da' adesso il margine. */}
      <div
        className={cn(
          'flex items-center justify-center text-subtle-foreground',
          compact ? 'mb-3' : 'mb-4'
        )}
      >
        {icon}
      </div>
      <h3 className="text-[15px] font-bold tracking-[-0.015em] mb-1.5">{title}</h3>
      <p className="text-[13px] text-muted-foreground max-w-xs leading-relaxed">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

/* ─── Divisore con etichetta ─── */

export function Divider({ label }: { label?: string }) {
  if (!label) return <div className="h-px bg-border my-4" />;
  return (
    <div className="flex items-center gap-3 my-4">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-subtle-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/* ─── Comparsa ritardata ───

   Evita il lampo di spinner sulle richieste veloci: se il caricamento dura
   meno della soglia, non si vede proprio niente. */

export function DelayedFallback({ delay = 220, children }: { delay?: number; children: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!show) return null;
  return <>{children}</>;
}
