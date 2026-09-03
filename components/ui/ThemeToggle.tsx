'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

/**
 * Interruttore chiaro/scuro.
 *
 * L'icona non si limita a cambiare: sole e luna si scambiano ruotando e
 * scalando, cosi' il gesto ha un verso. Finche' non sappiamo quale tema ha
 * scelto il browser (`pending`) non si disegna niente: meglio uno spazio
 * vuoto per un istante che l'icona sbagliata che poi salta.
 */
export function ThemeToggle({ size = 34, className }: { size?: number; className?: string }) {
  const { theme, pending, toggle } = useTheme();
  const dark = theme === 'dark';

  return (
    <motion.button
      type="button"
      onClick={toggle}
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
