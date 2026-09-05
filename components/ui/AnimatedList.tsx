'use client';

import { Children, useMemo, type ComponentPropsWithoutRef, type ReactElement, type ReactNode, type Ref } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────────────────
   Lista che si monta a cascata.

   Ogni figlio entra con una molla (scala + opacita') e, quando sparisce, gli
   altri risalgono scivolando invece di scattare: e' l'unica animazione che
   serve davvero a un elenco di notifiche, perche' rende leggibile CHE COSA e'
   stato tolto e da dove.

   NIENTE rivelazione a orologio. La versione originale di questo componente
   (Magic UI) mostra un elemento al secondo: e' pensata per la vetrina di una
   landing page, dove le notifiche sono finte e scorrono in loop. Qui l'elenco
   e' vero e puo' avere trenta voci: aspettare mezzo minuto per vedere la
   propria posta non e' un effetto, e' un'attesa. Il ritardo quindi non e' un
   timer che sblocca gli elementi uno alla volta, ma uno scarto di partenza
   fra animazioni che sono gia' tutte in corso — stessa cascata all'occhio,
   nessuna informazione trattenuta.

   Il ritardo si ferma a `maxStagger`: oltre la decima card siamo sotto la
   piega dello schermo, e continuare a sommare millisecondi vorrebbe dire far
   comparire l'ultima voce quando l'utente ha gia' scrollato fin li'.
   ───────────────────────────────────────────────────────────────────────── */

export interface AnimatedListProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
  /** Scarto fra l'ingresso di una card e quello della successiva, in ms. */
  stagger?: number;
  /** Indice oltre il quale le card partono tutte insieme. */
  maxStagger?: number;
}

export function AnimatedList({
  children,
  className,
  stagger = 45,
  maxStagger = 10,
  ...props
}: AnimatedListProps) {
  const reduced = useReducedMotion();
  const items = useMemo(() => Children.toArray(children), [children]);

  return (
    <div className={cn('flex flex-col gap-2.5', className)} {...props}>
      {/* `popLayout`: la card che esce viene tolta subito dal flusso, cosi' le
          altre iniziano a risalire mentre lei sta ancora svanendo. Senza,
          l'elenco resta fermo finche' l'uscita non e' finita e il vuoto si
          chiude di colpo. */}
      <AnimatePresence mode="popLayout">
        {items.map((item, i) => (
          <AnimatedListItem
            key={(item as ReactElement).key ?? i}
            delay={(Math.min(i, maxStagger) * stagger) / 1000}
            reduced={!!reduced}
          >
            {item}
          </AnimatedListItem>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * `ref`: lo passa AnimatePresence in `popLayout`, che per togliere una card
 * dal flusso deve prima misurarla. Un componente che non lo inoltra non viene
 * mai misurato, l'uscita non si conclude mai e i nodi gia' cancellati restano
 * nel DOM per sempre.
 */
function AnimatedListItem({
  children,
  delay,
  reduced,
  ref,
}: {
  children: ReactNode;
  delay: number;
  reduced: boolean;
  ref?: Ref<HTMLDivElement>;
}) {
  // Con `prefers-reduced-motion` si spengono le animazioni, NON si cambia
  // elemento: se il ramo ridotto rendesse un <div> semplice, il markup del
  // server (dove la preferenza non si conosce) e quello del client non
  // coinciderebbero e l'idratazione fallirebbe.
  return (
    <motion.div
      ref={ref}
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, scale: 0.94 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: reduced
          ? { duration: 0 }
          : { type: 'spring', stiffness: 340, damping: 34, delay },
      }}
      exit={{
        opacity: 0,
        scale: reduced ? 1 : 0.92,
        transition: reduced ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
      }}
      transition={{ layout: { type: 'spring', stiffness: 420, damping: 42 } }}
      className="w-full"
      // La card cresce dal bordo alto: e' il lato da cui "arriva" nell'elenco.
      style={{ transformOrigin: 'top center' }}
    >
      {children}
    </motion.div>
  );
}
