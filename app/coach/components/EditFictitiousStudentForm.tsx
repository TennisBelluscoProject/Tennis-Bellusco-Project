'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button, Modal } from '@/components/UI';
import type { Profile } from '@/lib/database.types';
import { isClassified } from '@/lib/constants';
import { FitRankingSelect } from '@/components/FitRankingSelect';

interface Props {
  open: boolean;
  student: Profile;
  onClose: () => void;
  onSaved: () => void;
}

type Level = 'Principiante' | 'Intermedio' | 'Avanzato';
const LIVELLI: Level[] = ['Principiante', 'Intermedio', 'Avanzato'];

/* ─────────────────────────────────────────────────────────────────────────
   Modifica di un allievo GESTITO dal maestro.

   Gli allievi fittizi (`is_fictitious = true`) non hanno un account: nessuno
   puo' accedere per loro e correggersi i dati da solo. Finora questo voleva
   dire che una classifica sbagliata al momento della creazione restava li'
   per sempre — e la classifica non e' un'etichetta qualsiasi: decide chi
   conta come classificato, la categoria d'eta' mostrata e cosa si vede sulla
   scheda. L'unica via d'uscita era cancellare l'allievo e ricrearlo,
   buttando via obiettivi, percorsi e risultati.

   Stessi campi della creazione (app/coach/components/CreateStudentForm.tsx),
   perche' e' lo stesso insieme di dati: cambia solo che qui partono pieni.

   LA GUARDIA SU `is_fictitious` E' DOPPIA, come nella cancellazione: una in
   JavaScript e una nella query. Chi ha un account vero deve poter cambiare i
   propri dati solo dal proprio profilo, e un pannello del maestro non deve
   poterli sovrascrivere nemmeno per sbaglio.
   ───────────────────────────────────────────────────────────────────────── */

export function EditFictitiousStudentForm({ open, student, onClose, onSaved }: Props) {
  if (!open) return null;
  return <Body student={student} onClose={onClose} onSaved={onSaved} />;
}

function Body({ student, onClose, onSaved }: Omit<Props, 'open'>) {
  // `first_name`/`last_name` possono mancare sulle righe piu' vecchie: in quel
  // caso si ricavano dal nome completo, che c'e' sempre.
  const pezzi = student.full_name.trim().split(/\s+/);
  const [firstName, setFirstName] = useState(student.first_name ?? pezzi[0] ?? '');
  const [lastName, setLastName] = useState(student.last_name ?? pezzi.slice(1).join(' '));
  const [birthDate, setBirthDate] = useState(student.birth_date ?? '');

  const classificato = isClassified(student.ranking);
  const [ranking, setRanking] = useState(classificato ? student.ranking : '');
  const [unranked, setUnranked] = useState(!classificato);
  const [level, setLevel] = useState<Level>(
    (LIVELLI.includes(student.level as Level) ? student.level : 'Principiante') as Level
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError('');

    // Guardia in chiaro: mai toccare un account reale da questo pannello,
    // anche se le policy sul database lo bloccherebbero comunque.
    if (!student.is_fictitious) {
      return setError('Operazione non consentita su un account reale.');
    }

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    if (!cleanFirst) return setError('Inserisci il nome');
    if (!cleanLast) return setError('Inserisci il cognome');

    if (birthDate) {
      const ts = new Date(birthDate).getTime();
      if (Number.isNaN(ts)) return setError('Data di nascita non valida');
      if (ts < new Date('1900-01-01').getTime() || ts > Date.now()) {
        return setError('Data di nascita non valida');
      }
    }

    if (!unranked && !ranking.trim()) {
      return setError('Scegli la classifica FIT oppure spunta "Non classificato"');
    }

    setSaving(true);
    const { error: updErr } = await supabase
      .from('profiles')
      .update({
        full_name: `${cleanFirst} ${cleanLast}`.trim(),
        first_name: cleanFirst,
        last_name: cleanLast,
        birth_date: birthDate || null,
        ranking: unranked ? 'Non classificato' : ranking.trim(),
        level: unranked ? level : 'Principiante',
      })
      .eq('id', student.id)
      // Seconda guardia, quella che conta: la condizione viaggia con la query.
      .eq('is_fictitious', true);

    if (updErr) {
      setError(updErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const campo =
    'w-full px-3.5 py-2.5 rounded-xl border border-border bg-[var(--input-bg)] text-sm text-foreground ' +
    'placeholder:text-[var(--subtle-foreground)] focus:outline-none focus:ring-2 ' +
    'focus:ring-[var(--club-blue)]/10 focus:border-[var(--club-blue)] transition-all duration-200 ' +
    'disabled:bg-muted disabled:text-[var(--subtle-foreground)]';

  return (
    <Modal open onClose={onClose} title="Modifica allievo">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-foreground tracking-[-0.01em]">
              Nome<span className="text-[var(--club-red)] ml-0.5">*</span>
            </label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={campo} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-foreground tracking-[-0.01em]">
              Cognome<span className="text-[var(--club-red)] ml-0.5">*</span>
            </label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={campo} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-foreground tracking-[-0.01em]">
            Data di nascita
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            min="1900-01-01"
            max={new Date().toISOString().slice(0, 10)}
            className={campo}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-foreground tracking-[-0.01em]">
            Classifica FIT<span className="text-[var(--club-red)] ml-0.5">*</span>
          </label>
          <FitRankingSelect
            value={unranked ? '' : ranking}
            onChange={setRanking}
            disabled={unranked}
            className={campo}
          />
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none -mt-1">
          <input
            type="checkbox"
            checked={unranked}
            onChange={(e) => setUnranked(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--border-strong)] text-[var(--club-blue)] focus:ring-[var(--club-blue)]"
          />
          <span className="text-[13px] text-muted-foreground">Non classificato FIT</span>
        </label>

        {unranked && (
          <div className="flex flex-col gap-1.5 -mt-1">
            <label className="text-[13px] font-semibold text-foreground tracking-[-0.01em]">
              Livello tecnico<span className="text-[var(--club-red)] ml-0.5">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LIVELLI.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setLevel(opt)}
                  className={`py-2 rounded-xl border text-[13px] font-semibold transition-all ${
                    level === opt
                      ? 'bg-[var(--club-blue)] text-white border-[var(--club-blue)] shadow-sm'
                      : 'bg-card text-muted-foreground border-border hover:border-[var(--border-strong)]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <div className="flex gap-3 justify-end mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Salva modifiche
          </Button>
        </div>
      </form>
    </Modal>
  );
}
