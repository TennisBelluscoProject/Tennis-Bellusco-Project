'use client';

import { useState, useEffect } from 'react';
import type { Goal, GoalCategory, GoalStatus } from '@/lib/database.types';
import { CATEGORY_CONFIG, STATUS_CONFIG, STATUS_COLUMNS } from '@/lib/constants';
import { Button, Input, Textarea, Select, Modal } from './UI';

interface GoalFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Goal>) => Promise<void>;
  goal?: Goal | null;
  isCoach?: boolean;
}

export function GoalForm({ open, onClose, onSave, goal, isCoach }: GoalFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GoalCategory>('tecnica');
  const [status, setStatus] = useState<GoalStatus>('planned');
  const [deadline, setDeadline] = useState('');
  const [progress, setProgress] = useState(0);
  const [coachNotes, setCoachNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (goal) {
      setTitle(goal.title);
      setDescription(goal.description || '');
      setCategory(goal.category);
      setStatus(goal.status);
      setDeadline(goal.deadline || '');
      setProgress(goal.progress);
      setCoachNotes(goal.coach_notes || '');
    } else {
      setTitle('');
      setDescription('');
      setCategory('tecnica');
      setStatus('planned');
      setDeadline('');
      setProgress(0);
      setCoachNotes('');
    }
    setError('');
  }, [goal, open]);

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Inserisci un titolo'); return; }

    // Check deadline is not in the past for new goals
    if (!goal && deadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(deadline) < today) {
        setError('La scadenza non può essere nel passato');
        return;
      }
    }

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        category,
        status,
        deadline: deadline || null,
        progress: status === 'in_progress' ? progress : status === 'completed' ? 100 : 0,
        coach_notes: coachNotes.trim() || null,
        ...(status === 'completed' && !goal?.completed_at ? { completed_at: new Date().toISOString() } : {}),
      });
      onClose();
    } catch {
      setError('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions = Object.entries(CATEGORY_CONFIG).map(([k, v]) => ({
    value: k, label: `${v.icon} ${v.label}`,
  }));

  const statusOptions = STATUS_COLUMNS.map((s) => ({
    value: s, label: STATUS_CONFIG[s].labelIt,
  }));

  const today = new Date().toISOString().split('T')[0];

  return (
    <Modal open={open} onClose={onClose} title={goal ? 'Modifica obiettivo' : 'Nuovo obiettivo'}>
      <div className="flex flex-col gap-4">
        <Input label="Titolo" value={title} onChange={setTitle} required placeholder="Es. Migliorare il rovescio" />
        <Textarea label="Descrizione" value={description} onChange={setDescription} placeholder="Dettagli sull'obiettivo..." />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Categoria" value={category} onChange={(v) => setCategory(v as GoalCategory)} options={categoryOptions} required />
          <Select label="Stato" value={status} onChange={(v) => setStatus(v as GoalStatus)} options={statusOptions} />
        </div>

        <Input label="Scadenza" type="date" value={deadline} onChange={setDeadline} min={goal ? undefined : today} />

        {status === 'in_progress' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Progresso: {progress}%</label>
            <input
              type="range" min="0" max="100" step="5"
              value={progress}
              onChange={(e) => setProgress(parseInt(e.target.value))}
              className="w-full accent-[var(--club-blue)]"
            />
          </div>
        )}

        {isCoach && (
          <Textarea label="Note del maestro" value={coachNotes} onChange={setCoachNotes} placeholder="Note visibili all'allievo..." />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button variant="primary" loading={saving} onClick={handleSubmit}>{goal ? 'Salva modifiche' : 'Crea obiettivo'}</Button>
        </div>
      </div>
    </Modal>
  );
}
