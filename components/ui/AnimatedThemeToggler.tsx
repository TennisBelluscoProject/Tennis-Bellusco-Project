'use client';

import { useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

/**
 * Interruttore chiaro/scuro.
 *
 * L'icona si scambia ruotando (sole/luna), come prima. La novita' e' che il
 * cambio si propaga a tutta la pagina con un cerchio che si allarga dal
 * pulsante: usa la View Transition API, che scatta un fermo immagine del
 * tema vecchio e di quello nuovo e li anima come due livelli sovrapposti,
 * cosi' il cerchio e' un vero ritaglio (clip-path) sul tema nuovo e non una
 * dissolvenza incrociata generica.
 *
 * Dove l'API non c'e' — o l'utente ha chiesto meno movimento
 * (prefers-reduced-motion) — il tema cambia comunque: il cerchio e' un
 * abbellimento progressivo, non una condizione per poter cambiare tema.
 * `toggle()` (in ThemeContext) resta l'unica fonte di verita' per salvare la
 * scelta e applicarla: qui la si avvolge soltanto nell'animazione.
 *
 * Finche' non sappiamo quale tema ha scelto il browser (`pending`) non si
 * disegna niente: meglio uno spazio vuoto per un istante che l'icona
 * sbagliata che poi salta.
 */

// Durata del cerchio a tutto schermo: piu' lunga di --dur-slow (globals.css)
// perche' qui anima l'intero viewport, non un singolo elemento.
const REVEAL_DURATION_MS = 600;
// Stessa curva di --ease-out-quint (globals.css), duplicata qui perche'
// Element.animate() non risolve le custom property CSS nella stringa di
// easing.
const REVEAL_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

type ViewTransition = {
  ready: Promise<void>;
  finished: Promise<void>;
  updateCallbackDone: Promise<void>;
};

// L'API e' recente e non sempre presente nei tipi di lib.dom.d.ts installati:
// la dichiariamo minimale qui invece di scommettere sulla versione di
// TypeScript del progetto.
type DocumentWithViewTransitions = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => ViewTransition;
};

export function AnimatedThemeToggler({ size = 34, className }: { size?: number; className?: string }) {
  const { theme, pending, toggle } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dark = theme === 'dark';

  const handleClick = useCallback(() => {
    const button = buttonRef.current;
    const doc = document as DocumentWithViewTransitions;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!doc.startViewTransition || !button || prefersReducedMotion) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.info(
          '[AnimatedThemeToggler] Cerchio saltato:',
          !doc.startViewTransition
            ? 'il browser non supporta document.startViewTransition (es. Firefox, o Safari sotto la 18)'
            : prefersReducedMotion
              ? 'prefers-reduced-motion e\' attivo (sistema o browser)'
              : 'pulsante non ancora montato'
        );
      }
      toggle();
      return;
    }

    // Il cerchio parte dal centro del pulsante e deve coprire l'angolo piu'
    // lontano, altrimenti si vedrebbe un lembo di tema vecchio in un angolo.
    const { top, left, width, height } = button.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = doc.startViewTransition(() => {
      // flushSync: la View Transition API scatta il "prima" e il "dopo"
      // attorno a questo callback, quindi il cambio di classe deve essere
      // gia' nel DOM quando il callback ritorna, non in un render successivo.
      flushSync(() => toggle());
    });

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
          },
          {
            duration: REVEAL_DURATION_MS,
            easing: REVEAL_EASING,
            pseudoElement: '::view-transition-new(root)',
          } as unknown as KeyframeAnimationOptions
        );
      })
      .catch((err) => {
        // Transizione saltata (es. un'altra gia' in corso, o l'animate() con
        // `pseudoElement` non e' supportato su questo motore): il tema e'
        // comunque cambiato, sopra, dentro flushSync.
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.info('[AnimatedThemeToggler] Cerchio non partito:', err);
        }
      });
  }, [toggle]);

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      aria-label={dark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
      title={dark ? 'Tema chiaro' : 'Tema scuro'}
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 620, damping: 26 }}
      style={{ width: size, height: size }}
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 overflow-hidden',
        'rounded-[var(--radius-sm)] text-muted-foreground',
        'hover:text-foreground hover:bg-muted transition-colors duration-[var(--dur-base)]',
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!pending && (
          <motion.span
            key={dark ? 'moon' : 'sun'}
            initial={{ rotate: -70, scale: 0.4, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 70, scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {dark ? <Moon size={17} strokeWidth={2.1} /> : <Sun size={17} strokeWidth={2.1} />}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
