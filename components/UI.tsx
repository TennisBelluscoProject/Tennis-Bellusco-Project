'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

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
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-[var(--club-red)] text-white hover:bg-[var(--club-red-dark)] focus:ring-[var(--club-red)] shadow-sm hover:shadow-md active:scale-[0.97]',
    secondary: 'bg-[var(--club-blue)] text-white hover:bg-[var(--club-blue-dark)] focus:ring-[var(--club-blue)] shadow-sm hover:shadow-md active:scale-[0.97]',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm active:scale-[0.97]',
    ghost: 'bg-transparent text-[var(--foreground)] hover:bg-gray-100 focus:ring-gray-300 active:scale-[0.97]',
  };
  const sizes = {
    sm: 'text-[13px] px-3.5 py-1.5 gap-1.5',
    md: 'text-[13px] px-5 py-2.5 gap-2',
    lg: 'text-sm px-6 py-3 gap-2',
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
      {label && (
        <label className="text-[13px] font-semibold text-gray-700 tracking-[-0.01em]">
          {label}
          {required && <span className="text-[var(--club-red)] ml-0.5">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)]/10 focus:border-[var(--club-blue)] transition-all duration-200"
      />
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
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
      {label && <label className="text-[13px] font-semibold text-gray-700 tracking-[-0.01em]">{label}</label>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)]/10 focus:border-[var(--club-blue)] transition-all duration-200 resize-none"
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
      {label && (
        <label className="text-[13px] font-semibold text-gray-700 tracking-[-0.01em]">
          {label}
          {required && <span className="text-[var(--club-red)] ml-0.5">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)]/10 focus:border-[var(--club-blue)] transition-all duration-200 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
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
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
        checked
          ? 'bg-[var(--club-blue)] border-[var(--club-blue)]'
          : 'border-gray-300 group-hover:border-gray-400'
      }`}>
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
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
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1.5">{title}</h3>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">{message}</p>
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
          <h3 className="text-lg font-bold text-gray-900 tracking-[-0.01em]">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
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
    <div className="flex border-b border-gray-200 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative flex-1 sm:flex-none px-5 py-3.5 text-[13px] font-semibold transition-all duration-200 whitespace-nowrap ${
              isActive
                ? 'text-[var(--club-blue)]'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
            {isActive && <span className="tab-indicator" />}
          </button>
        );
      })}
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
    <span
      className="badge"
      style={{ color, backgroundColor: bg }}
    >
      {children}
    </span>
  );
}

// ─── StatCard ───────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
}

export function StatCard({ label, value, icon, color = 'var(--club-blue)' }: StatCardProps) {
  return (
    <div className="card stat-card p-4" style={{ '--stat-accent': color } as React.CSSProperties}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        {icon && <span className="text-base">{icon}</span>}
      </div>
      <p className="text-[26px] font-bold tracking-[-0.02em]" style={{ color }}>{value}</p>
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
      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)]/10 focus:border-[var(--club-blue)] transition-all duration-200"
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
    <div className="progress-track w-full bg-gray-100" style={{ height }}>
      <div
        className="progress-fill h-full"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── Empty State ────────────────────────────────────
interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-3xl bg-gray-100/60 flex items-center justify-center mb-5 text-gray-300">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2 tracking-[-0.01em]">{title}</h3>
      <p className="text-[14px] text-gray-500 mb-6 max-w-sm leading-relaxed">{message}</p>
      {action}
    </div>
  );
}

// ─── Loading Spinner ────────────────────────────────
export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="var(--club-blue)" strokeWidth="3" />
      <path className="opacity-80" fill="var(--club-blue)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-[var(--background)]">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          {/* Outer ring */}
          <div
            className="w-16 h-16 rounded-2xl border-2 border-[var(--club-red)]/20 flex items-center justify-center"
            style={{ animation: 'pulse-soft 2.4s ease-in-out infinite' }}
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--club-red)] flex items-center justify-center shadow-sm">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p
            className="text-sm font-semibold text-[var(--club-blue)] tracking-[-0.01em]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Tennis Club Bellusco
          </p>
          <p className="text-xs text-gray-400">Caricamento...</p>
        </div>
      </div>
    </div>
  );
}
