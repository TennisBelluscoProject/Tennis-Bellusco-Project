'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';

// ─── Button ─────────────────────────────────────────
interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  onClick?: () => void;
}

export function Button({
  children, variant = 'primary', size = 'md', disabled, loading, className = '', type = 'button', onClick,
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]';
  const variants = {
    primary: 'bg-[var(--club-red)] text-white hover:bg-[var(--club-red-dark)] focus:ring-[var(--club-red)] shadow-sm',
    secondary: 'bg-[var(--club-blue)] text-white hover:bg-[var(--club-blue-dark)] focus:ring-[var(--club-blue)] shadow-sm',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm',
    ghost: 'bg-transparent text-[var(--foreground)] hover:bg-gray-100 focus:ring-gray-300',
  };
  const sizes = {
    sm: 'text-sm px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-6 py-3 gap-2',
  };

  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

// ─── Input ──────────────────────────────────────────
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
}

export function Input({ label, type = 'text', value, onChange, placeholder, required, error, className = '', min }: InputProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-sm font-medium text-gray-700">{label}{required && <span className="text-[var(--club-red)] ml-0.5">*</span>}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)] focus:border-transparent transition-all"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── Textarea ───────────────────────────────────────
interface TextareaProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function Textarea({ label, value, onChange, placeholder, rows = 3, className = '' }: TextareaProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)] focus:border-transparent transition-all resize-none"
      />
    </div>
  );
}

// ─── Select ─────────────────────────────────────────
interface SelectProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export function Select({ label, value, onChange, options, placeholder, className = '', required }: SelectProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-sm font-medium text-gray-700">{label}{required && <span className="text-[var(--club-red)] ml-0.5">*</span>}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)] focus:border-transparent transition-all appearance-none"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Checkbox ───────────────────────────────────────
interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4.5 h-4.5 rounded border-gray-300 text-[var(--club-blue)] focus:ring-[var(--club-blue)]"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

// ─── Dialog (Confirm) ───────────────────────────────
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Conferma', cancelLabel = 'Annulla', variant = 'danger', onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog-content p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-content animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Tabs ───────────────────────────────────────────
interface TabsProps {
  tabs: { id: string; label: string; icon?: string }[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            active === tab.id
              ? 'bg-white text-[var(--club-blue)] shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.icon && <span>{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Badge ──────────────────────────────────────────
interface BadgeProps {
  children: ReactNode;
  color?: string;
  bg?: string;
}

export function Badge({ children, color = '#1B3A5C', bg = '#E8EDF2' }: BadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium" style={{ color, backgroundColor: bg }}>
      {children}
    </span>
  );
}

// ─── StatCard ───────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
}

export function StatCard({ label, value, icon, color = 'var(--club-blue)' }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

// ─── SearchBar ──────────────────────────────────────
interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Cerca...' }: SearchBarProps) {
  return (
    <div className="relative">
      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)] focus:border-transparent transition-all"
      />
    </div>
  );
}

// ─── ProgressBar ────────────────────────────────────
interface ProgressBarProps {
  value: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ value, color = 'var(--club-blue)', height = 6 }: ProgressBarProps) {
  return (
    <div className="w-full bg-gray-100 rounded-full overflow-hidden" style={{ height }}>
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── Empty State ────────────────────────────────────
interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl mb-3">{icon}</span>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4 max-w-xs">{message}</p>
      {action}
    </div>
  );
}

// ─── Loading Spinner ────────────────────────────────
export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="var(--club-blue)" strokeWidth="4" />
      <path className="opacity-75" fill="var(--club-blue)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-[var(--background)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[var(--club-red)] flex items-center justify-center animate-pulse-soft">
          <span className="text-2xl">🎾</span>
        </div>
        <p className="text-sm text-gray-500">Caricamento...</p>
      </div>
    </div>
  );
}
