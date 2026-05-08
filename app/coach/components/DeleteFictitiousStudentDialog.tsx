'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/UI';
import type { Profile } from '@/lib/database.types';

interface Props {
  open: boolean;
  student: Profile;
  onClose: () => void;
  /** Called after a successful deletion. The parent should navigate away from the student detail. */
  onDeleted: () => void;
}

/**
 * Confirmation dialog for permanently deleting a "fictitious" (coach-managed) student.
 *
 * Safety pattern (à la GitHub / Vercel / Supabase project deletion):
 * the destructive button stays disabled until the coach types the exact phrase
 *   `cancella <full_name>`
 * (case-insensitive, whitespace-trimmed) into a text field. This prevents
 * accidental deletions and forces a deliberate motor action before the row
 * is removed from `public.profiles` (which RLS allows only when
 * `is_fictitious = true`).
 *
 * NOTE: this component must NEVER be opened for a non-fictitious student;
 * the caller already gates rendering on `student.is_fictitious === true`.
 */
export function DeleteFictitiousStudentDialog({ open, student, onClose, onDeleted }: Props) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state every time the dialog opens so we don't leak input across deletions.
  useEffect(() => {
    if (open) {
      setConfirmText('');
      setError(null);
      setDeleting(false);
      // Small delay so the modal animation finishes before grabbing focus.
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Lock body scroll while open (matches Modal behaviour).
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const expectedPhrase = `cancella ${student.full_name}`;
  const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const isMatch = normalize(confirmText) === normalize(expectedPhrase);

  const handleDelete = async () => {
    if (!isMatch || deleting) return;
    setDeleting(true);
    setError(null);

    // Hard guard: never delete a real (non-fictitious) profile from this UI,
    // even if RLS would block it server-side.
    if (!student.is_fictitious) {
      setError('Operazione non consentita su un account reale.');
      setDeleting(false);
      return;
    }

    const { error: delErr } = await supabase
      .from('profiles')
      .delete()
      .eq('id', student.id)
      .eq('is_fictitious', true);

    if (delErr) {
      setError(delErr.message);
      setDeleting(false);
      return;
    }

    setDeleting(false);
    onDeleted();
  };

  return (
    <div className="dialog-backdrop" onClick={deleting ? undefined : onClose}>
      <div
        className="dialog-content p-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-fictitious-title"
      >
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <AlertTriangle size={24} strokeWidth={2} color="#EF4444" />
        </div>

        <h3 id="delete-fictitious-title" className="text-lg font-bold text-gray-900 mb-1.5">
          Eliminare definitivamente l&apos;allievo?
        </h3>
        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
          Stai per cancellare il profilo gestito di{' '}
          <span className="font-semibold text-gray-700">{student.full_name}</span>. Verranno
          rimossi anche tutti i suoi obiettivi, risultati e dati associati. L&apos;operazione è
          <span className="font-semibold text-[var(--club-red)]"> irreversibile</span>.
        </p>

        <div className="bg-red-50/60 border border-red-100 rounded-xl px-4 py-3 mb-4">
          <p className="text-[12px] text-red-800 leading-relaxed">
            Per confermare, scrivi qui sotto:{' '}
            <code className="font-mono font-semibold bg-white/70 px-1.5 py-0.5 rounded text-[11.5px] text-red-900">
              cancella {student.full_name}
            </code>
          </p>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={`cancella ${student.full_name}`}
          disabled={deleting}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/15 focus:border-red-400 transition-all duration-200 disabled:bg-gray-50 disabled:text-gray-400 mb-4"
        />

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100 mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={deleting}>
            Annulla
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={!isMatch || deleting}
            loading={deleting}
          >
            <Trash2 size={16} strokeWidth={2.2} />
            Elimina definitivamente
          </Button>
        </div>
      </div>
    </div>
  );
}
