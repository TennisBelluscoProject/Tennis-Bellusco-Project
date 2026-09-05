'use client';

import { useId, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────────────────
   Base condivisa dai campi. Un unico posto per bordo, altezza e stato di
   focus: se cambia qui, cambia in tutti i form dell'app.
   ───────────────────────────────────────────────────────────────────────── */

const FIELD_BASE =
  'w-full bg-[var(--input-bg)] text-foreground placeholder:text-subtle-foreground ' +
  'border border-input rounded-[var(--radius-md)] ' +
  'transition-[border-color,box-shadow,background-color] duration-[var(--dur-base)] ' +
  'focus:outline-none focus:border-[var(--ring)] focus:shadow-[0_0_0_3px_var(--primary-soft)]';

function Label({ children, required, htmlFor }: { children: ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[12px] font-semibold text-muted-foreground tracking-[0.005em]"
    >
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );
}

/** Messaggio d'errore che scivola dentro invece di far saltare il layout. */
function FieldError({ error }: { error?: string }) {
  return (
    <AnimatePresence initial={false}>
      {error && (
        <motion.p
          initial={{ opacity: 0, height: 0, y: -4 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-[12px] font-medium text-destructive overflow-hidden"
        >
          {error}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/* ─── Input ─── */

interface InputProps {
  label?: string;
  type?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  className?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  icon?: ReactNode;
  hint?: string;
}

export function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  error,
  className = '',
  min,
  max,
  disabled,
  icon,
  hint,
}: InputProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <Label htmlFor={id} required={required}>{label}</Label>}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle-foreground pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          min={min}
          max={max}
          aria-invalid={!!error}
          className={cn(
            FIELD_BASE,
            'h-10 px-3 text-sm disabled:opacity-50',
            icon && 'pl-9',
            error && 'border-destructive focus:border-destructive focus:shadow-[0_0_0_3px_var(--destructive-soft)]'
          )}
        />
      </div>
      {hint && !error && <p className="text-[11px] text-subtle-foreground">{hint}</p>}
      <FieldError error={error} />
    </div>
  );
}

/* ─── Textarea ─── */

interface TextareaProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  error?: string;
  maxLength?: number;
}

export function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  className = '',
  error,
  maxLength,
}: TextareaProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={id}>{label}</Label>
          {maxLength && (
            <span className="text-[11px] tnum text-subtle-foreground">
              {value.length}/{maxLength}
            </span>
          )}
        </div>
      )}
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className={cn(FIELD_BASE, 'px-3 py-2.5 text-sm resize-none leading-relaxed')}
      />
      <FieldError error={error} />
    </div>
  );
}

/* ─── Select ─── */

interface SelectProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  className = '',
  required,
  disabled,
}: SelectProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <Label htmlFor={id} required={required}>{label}</Label>}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          className={cn(
            FIELD_BASE,
            'h-10 pl-3 pr-9 text-sm appearance-none cursor-pointer disabled:opacity-50'
          )}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle-foreground pointer-events-none"
        />
      </div>
    </div>
  );
}

/* ─── Checkbox ─── */

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({ label, checked, onChange, disabled }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 group text-left disabled:opacity-50"
    >
      <motion.span
        animate={{
          backgroundColor: checked ? 'var(--primary)' : 'transparent',
          borderColor: checked ? 'var(--primary)' : 'var(--border-strong)',
        }}
        whileTap={{ scale: 0.88 }}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        className="w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0"
      >
        <AnimatePresence>
          {checked && (
            <motion.span
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 700, damping: 28 }}
            >
              <Check size={12} strokeWidth={3.4} color="var(--primary-foreground)" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
      <span className="text-sm text-foreground">{label}</span>
    </button>
  );
}

/* ─── Barra di ricerca ─── */

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Cerca…', className }: SearchBarProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle-foreground pointer-events-none"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(FIELD_BASE, 'h-10 pl-9 pr-9 text-sm [&::-webkit-search-cancel-button]:hidden')}
      />
      <AnimatePresence>
        {value && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            onClick={() => onChange('')}
            aria-label="Cancella ricerca"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle-foreground hover:text-foreground"
          >
            <X size={15} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Interruttore ─── */

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-[42px] h-[24px] rounded-full shrink-0 p-[3px] transition-colors duration-[var(--dur-base)] disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-[var(--border-strong)]'
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 640, damping: 34 }}
        className="block w-[18px] h-[18px] rounded-full bg-white shadow-[var(--shadow-sm)]"
        style={{ marginLeft: checked ? 18 : 0 }}
      />
    </button>
  );
}

/* ─── Slider (progresso di un obiettivo) ─── */

export function Slider({
  value,
  onChange,
  onCommit,
  color = 'var(--primary)',
  step = 5,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  /**
   * Chiamata quando il gesto FINISCE: dito o mouse sollevati, tasto freccia
   * rilasciato. Serve a distinguere il valore che si sta ancora scegliendo da
   * quello scelto.
   *
   * `onChange` scatta a ogni scatto del cursore, quindi non e' il posto dove
   * scrivere sul database: trascinando da zero a cento partirebbero venti
   * richieste in fila, che possono anche tornare in ordine sparso. `onCommit`
   * scatta una volta sola, alla fine del gesto — che e' anche il momento in
   * cui, per chi guarda, "ha spostato il cursore".
   */
  onCommit?: (v: number) => void;
  color?: string;
  step?: number;
  label?: string;
}) {
  // `pointerup` arriva sull'input anche se il dito finisce lontano: durante il
  // trascinamento il browser gli assegna la cattura del puntatore. `keyup`
  // copre le frecce della tastiera.
  const commit = (e: { currentTarget: HTMLInputElement }) =>
    onCommit?.(Number(e.currentTarget.value));

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-muted-foreground">{label}</span>
          <span className="text-[13px] font-bold tnum" style={{ color }}>
            {value}%
          </span>
        </div>
      )}
      <input
        type="range"
        min={0}
        max={100}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit ? commit : undefined}
        onKeyUp={onCommit ? commit : undefined}
        className="tcb-slider w-full"
        style={{ ['--slider-color' as string]: color, ['--slider-pct' as string]: `${value}%` }}
      />
    </div>
  );
}
