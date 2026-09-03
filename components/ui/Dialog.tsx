'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, IconButton, type ButtonVariant } from './Button';
import { useIsMobile } from '@/lib/hooks';

/* ─────────────────────────────────────────────────────────────────────────
   Dialog

   Una sola implementazione per due forme:
     - da telefono e' un foglio che sale dal basso e si chiude trascinandolo
       giu', perche' il pollice sta in fondo allo schermo;
     - da desktop e' una finestra centrata che entra in scala.

   Perche' un portale: il contenuto deve stare fuori da qualunque antenato
   con `overflow: hidden` o `transform` (di cui questa app e' piena, fra
   Kanban e mappa dei percorsi), altrimenti verrebbe ritagliato o
   riposizionato rispetto al contenitore invece che al viewport.
   ───────────────────────────────────────────────────────────────────────── */

const SPRING = { type: 'spring' as const, stiffness: 380, damping: 34, mass: 0.8 };

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** Blocca lo scorrimento della pagina sotto al dialog, senza far saltare il layout. */
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const { overflow, paddingRight } = document.body.style;
    // Compensa la scrollbar che sparisce, altrimenti su desktop la pagina
    // "salta" di qualche pixel a ogni apertura.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [active]);
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Larghezza massima su desktop. */
  size?: 'sm' | 'md' | 'lg';
  /** Nasconde la X in alto a destra (per i dialog che chiudono solo da pulsante). */
  hideClose?: boolean;
}

const SIZE_CLASS = {
  sm: 'sm:max-w-[400px]',
  md: 'sm:max-w-[520px]',
  lg: 'sm:max-w-[720px]',
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideClose = false,
}: DialogProps) {
  const mounted = useMounted();
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement>(null);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Il foglio si chiude se lo trascini abbastanza in basso O abbastanza in
  // fretta: il gesto veloce e corto e' quello che si fa istintivamente, e
  // pretendere solo la distanza lo farebbe sembrare bloccato.
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 550) onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            // Nessuna sfocatura sul fondo: sfocare l'intera pagina mentre si
            // anima l'opacita' significa rigenerare la sfocatura a ogni
            // fotogramma dell'apertura. E' costoso e su telefono si vede
            // scattare proprio nel momento in cui il foglio sale.
            className="absolute inset-0 bg-[var(--overlay)]"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={isMobile ? { y: '100%' } : { opacity: 0, y: 12, scale: 0.97 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={SPRING}
            drag={isMobile ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={isMobile ? onDragEnd : undefined}
            className={cn(
              'relative w-full bg-popover text-popover-foreground',
              'rounded-t-[var(--radius-2xl)] sm:rounded-[var(--radius-xl)]',
              'border border-border shadow-[var(--shadow-xl)]',
              'max-h-[92dvh] sm:max-h-[88dvh] flex flex-col',
              'pb-[env(safe-area-inset-bottom)] sm:pb-0',
              SIZE_CLASS[size]
            )}
          >
            {/* Maniglia: dice "questo si trascina" senza scriverlo. */}
            {isMobile && (
              <div className="pt-2.5 pb-1 flex justify-center shrink-0 cursor-grab active:cursor-grabbing">
                <span className="w-9 h-1 rounded-full bg-[var(--border-strong)]" />
              </div>
            )}

            {(title || !hideClose) && (
              <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 shrink-0">
                <div className="min-w-0">
                  {title && (
                    <h3 className="text-[17px] font-bold tracking-[-0.02em] truncate">{title}</h3>
                  )}
                  {description && (
                    <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>
                {!hideClose && (
                  <IconButton
                    label="Chiudi"
                    size={30}
                    onClick={onClose}
                    icon={<X size={16} />}
                    className="-mr-1 -mt-0.5"
                  />
                )}
              </div>
            )}

            <div className="px-5 pb-5 overflow-y-auto overscroll-contain flex-1 min-h-0">
              {children}
            </div>

            {footer && (
              <div className="px-5 py-3.5 border-t border-border-soft bg-[var(--card)] rounded-b-[var(--radius-xl)] shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ─── Modal: nome storico, stessa cosa ─── */

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {children}
    </Dialog>
  );
}

/* ─── Conferma ─── */

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  variant = 'danger',
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const danger = variant === 'danger';
  return (
    <Dialog open={open} onClose={onCancel} size="sm" hideClose>
      <div className="pt-2">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 26, delay: 0.06 }}
          className={cn(
            'w-11 h-11 rounded-[var(--radius-lg)] flex items-center justify-center mb-4',
            danger ? 'bg-destructive-soft text-destructive' : 'bg-primary-soft text-primary'
          )}
        >
          <AlertTriangle size={21} strokeWidth={2.2} />
        </motion.div>
        <h3 className="text-[17px] font-bold tracking-[-0.02em] mb-1.5">{title}</h3>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed">{message}</p>
      </div>

      <div className="flex gap-2.5 justify-end mt-6">
        <Button variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

export type { ButtonVariant };
