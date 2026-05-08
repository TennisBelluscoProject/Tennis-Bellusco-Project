'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Modal } from '@/components/UI';
import type { Profile } from '@/lib/database.types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (created: Profile) => void;
}

type Level = 'Principiante' | 'Intermedio' | 'Avanzato';

export function CreateStudentForm({ open, onClose, onCreated }: Props) {
  if (!open) return null;
  return <CreateStudentFormBody onClose={onClose} onCreated={onCreated} />;
}

function CreateStudentFormBody({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (created: Profile) => void;
}) {
  const { user } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [ranking, setRanking] = useState('');
  const [unranked, setUnranked] = useState(true);
  const [level, setLevel] = useState<Level>('Principiante');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError('');

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    if (!cleanFirst) return setError('Inserisci il nome');
    if (!cleanLast) return setError('Inserisci il cognome');

    if (birthDate) {
      const ts = new Date(birthDate).getTime();
      if (Number.isNaN(ts)) return setError('Data di nascita non valida');
      const minTs = new Date('1900-01-01').getTime();
      const maxTs = Date.now();
      if (ts < minTs || ts > maxTs) return setError('Data di nascita non valida');
    }

    if (!unranked && !ranking.trim()) {
      return setError('Inserisci la classifica FIT oppure spunta "Non classificato"');
    }

    setSaving(true);
    const fullName = `${cleanFirst} ${cleanLast}`.trim();
    const { data, error: insErr } = await supabase
      .from('profiles')
      .insert({
        role: 'allievo',
        full_name: fullName,
        first_name: cleanFirst,
        last_name: cleanLast,
        birth_date: birthDate || null,
        ranking: unranked ? 'Non classificato' : ranking.trim(),
        level: unranked ? level : 'Principiante',
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user?.id ?? null,
        active: true,
        is_fictitious: true,
      })
      .select('*')
      .single();

    if (insErr) {
      setError(insErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onCreated(data as Profile);
    onClose();
  };

  return (
    <Modal open={true} onClose={onClose} title="Aggiungi allievo">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A5C" strokeWidth="2" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <p className="text-[12px] text-[var(--club-blue)] leading-relaxed">
            Crea un profilo per un allievo che non ha email/password (es. minore di 10 anni).
            Potrai aggiungere obiettivi e risultati come per gli altri allievi.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Nome" value={firstName} onChange={setFirstName} placeholder="Mario" required />
          <Input label="Cognome" value={lastName} onChange={setLastName} placeholder="Rossi" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-gray-700 tracking-[-0.01em]">
            Data di nascita
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            min="1900-01-01"
            max={new Date().toISOString().slice(0, 10)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)]/10 focus:border-[var(--club-blue)] transition-all duration-200"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-gray-700 tracking-[-0.01em]">
            Classifica FIT<span className="text-[var(--club-red)] ml-0.5">*</span>
          </label>
          <input
            type="text"
            value={unranked ? '' : ranking}
            onChange={(e) => setRanking(e.target.value)}
            placeholder={unranked ? 'Non classificato' : 'es. 3.5'}
            disabled={unranked}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)]/10 focus:border-[var(--club-blue)] transition-all duration-200 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none -mt-1">
          <input
            type="checkbox"
            checked={unranked}
            onChange={(e) => setUnranked(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-[var(--club-blue)] focus:ring-[var(--club-blue)]"
          />
          <span className="text-[13px] text-gray-600">Non classificato FIT</span>
        </label>

        {unranked && (
          <div className="flex flex-col gap-1.5 -mt-1">
            <label className="text-[13px] font-semibold text-gray-700 tracking-[-0.01em]">
              Livello tecnico<span className="text-[var(--club-red)] ml-0.5">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Principiante', 'Intermedio', 'Avanzato'] as const).map((opt) => {
                const active = level === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setLevel(opt)}
                    className={`py-2 rounded-xl border text-[13px] font-semibold transition-all ${
                      active
                        ? 'bg-[var(--club-blue)] text-white border-[var(--club-blue)] shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100 flex items-start gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3 justify-end mt-2">
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button type="submit" variant="secondary" loading={saving}>Crea allievo</Button>
        </div>
      </form>
    </Modal>
  );
}
