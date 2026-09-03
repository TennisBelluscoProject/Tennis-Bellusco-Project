'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Info, TriangleAlert, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────────────────
   Notifiche brevi.

   Servono soprattutto a una cosa: dare un "Annulla" alle azioni che
   spostano roba. Quando un obiettivo passa a "In corso" restando sulla
   pagina, il messaggio in fondo e' l'unica conferma che qualcosa e'
   successo — e l'unico modo per tornare indietro senza cercare la card.
   ───────────────────────────────────────────────────────────────────────── */

export type ToastTone = 'default' | 'success' | 'error' | 'info';

export interface ToastOptions {
  message: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
  /** Se presente, compare il pulsante "Annulla". */
  onUndo?: () => void;
  undoLabel?: string;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastApi {
  toast: (opts: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_STYLE: Record<ToastTone, { icon: ReactNode; ring: string }> = {
  default: { icon: <Info size={15} />, ring: 'text-muted-foreground' },
  success: { icon: <Check size={15} strokeWidth={3} />, ring: 'text-success' },
  error: { icon: <TriangleAlert size={15} />, ring: 'text-destructive' },
  info: { icon: <Info size={15} />, ring: 'text-primary' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = nextId.current++;
      // Al massimo tre in pila: oltre, la colonna copre l'interfaccia e
      // nessuno le legge comunque.
      setItems((prev) => [...prev.slice(-2), { ...opts, id }]);
      const duration = opts.duration ?? (opts.onUndo ? 6000 : 3400);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration)
      );
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <motion.div
            // Contenitore `position: fixed` con dentro elementi che animano la
            // posizione: senza `layoutRoot`, motion misura rispetto alla
            // pagina invece che al riquadro fisso e le notifiche impilate
            // scivolano di traverso quando una sparisce.
            layoutRoot
            className={cn(
              'fixed z-[70] flex flex-col gap-2 pointer-events-none',
              // Su telefono in basso, sopra la bottom bar; su desktop in
              // basso a destra, dove non copre il contenuto.
              'left-3 right-3 bottom-[calc(1rem+env(safe-area-inset-bottom))]',
              'sm:left-auto sm:right-5 sm:bottom-5 sm:w-[360px]'
            )}
          >
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <ToastRow key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
              ))}
            </AnimatePresence>
          </motion.div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const tone = TONE_STYLE[item.tone ?? 'default'];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.16 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.35}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 90) onDismiss();
      }}
      className={cn(
        'pointer-events-auto flex items-center gap-3 px-3.5 py-3',
        'rounded-[var(--radius-lg)] border border-border bg-popover text-popover-foreground',
        'shadow-[var(--shadow-lg)] cursor-grab active:cursor-grabbing'
      )}
    >
      <span className={cn('shrink-0', tone.ring)}>{tone.icon}</span>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-snug truncate">{item.message}</p>
        {item.description && (
          <p className="text-[12px] text-muted-foreground leading-snug truncate">
            {item.description}
          </p>
        )}
      </div>

      {item.onUndo && (
        <button
          onClick={() => {
            item.onUndo?.();
            onDismiss();
          }}
          className="shrink-0 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-primary hover:underline px-1"
        >
          <Undo2 size={13} strokeWidth={2.6} />
          {item.undoLabel ?? 'Annulla'}
        </button>
      )}

      <button
        onClick={onDismiss}
        aria-label="Chiudi"
        className="shrink-0 text-subtle-foreground hover:text-foreground"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast va usato dentro <ToastProvider>');
  return ctx;
}
