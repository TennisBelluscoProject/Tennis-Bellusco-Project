'use client';

import { forwardRef, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'subtle'
  | 'danger'
  | 'success';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-primary)]',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-[var(--secondary-hover)]',
  outline:
    'bg-transparent text-foreground border border-border hover:border-[var(--border-strong)] hover:bg-muted',
  ghost: 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted',
  subtle: 'bg-primary-soft text-[var(--accent-foreground)] hover:bg-[var(--primary-soft-hover)]',
  danger:
    'bg-destructive text-[var(--destructive-foreground)] hover:bg-[var(--destructive-hover)] shadow-[var(--shadow-xs)]',
  success:
    'bg-success text-[var(--success-foreground)] hover:brightness-110 shadow-[var(--shadow-xs)]',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'text-[12px] h-7 px-2.5 gap-1.5 rounded-[var(--radius-xs)]',
  sm: 'text-[13px] h-8 px-3 gap-1.5 rounded-[var(--radius-sm)]',
  md: 'text-[13px] h-10 px-4 gap-2 rounded-[var(--radius-md)]',
  lg: 'text-sm h-11 px-5 gap-2 rounded-[var(--radius-md)]',
  icon: 'h-9 w-9 rounded-[var(--radius-sm)]',
};

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children' | 'ref'> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Occupa tutta la larghezza disponibile. */
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

/**
 * Il pulsante dell'app.
 *
 * La reazione al tocco e' una molla, non una transizione lineare: si schiaccia
 * subito e torna su con un accenno di rimbalzo, che e' quello che rende un
 * pulsante "solido" al dito invece che una zona cliccabile qualsiasi.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    block = false,
    icon,
    iconRight,
    disabled,
    className,
    ...rest
  },
  ref
) {
  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      whileTap={disabled || loading ? undefined : { scale: 0.965 }}
      transition={{ type: 'spring', stiffness: 620, damping: 26, mass: 0.5 }}
      className={cn(
        'relative inline-flex items-center justify-center font-semibold select-none whitespace-nowrap',
        'transition-[background-color,color,border-color,box-shadow,opacity] duration-[var(--dur-base)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
        'disabled:opacity-45 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 size={size === 'lg' ? 17 : 15} className="animate-spin" /> : icon}
      {children}
      {!loading && iconRight}
    </motion.button>
  );
});

/**
 * Pulsante di sola icona. L'etichetta e' obbligatoria: senza testo visibile
 * il nome accessibile deve pur arrivare da qualche parte.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'children' | 'size'> & { label: string; size?: number }
>(function IconButton({ label, icon, size = 34, variant = 'ghost', className, ...rest }, ref) {
  return (
    <motion.button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 620, damping: 26, mass: 0.5 }}
      style={{ width: size, height: size }}
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-sm)] shrink-0',
        'transition-colors duration-[var(--dur-base)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
        'disabled:opacity-45 disabled:pointer-events-none',
        VARIANTS[variant],
        className
      )}
      {...rest}
    >
      {icon}
    </motion.button>
  );
});
