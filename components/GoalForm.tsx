'use client';

import { useState, useEffect } from 'react';
import { ClipboardList, PencilLine } from 'lucide-react';
import type { Goal, GoalCategory, GoalStatus, GoalTemplate, PlayerLevel } from '@/lib/database.types';
import { CATEGORY_CONFIG, STATUS_CONFIG, STATUS_COLUMNS } from '@/lib/constants';
import { Button, Input, Textarea, Select, Modal } from './UI';
import { GoalTemplatePicker } from './GoalTemplatePicker';
import { CategoryIcon } from './CategoryIcon';

interface GoalFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Goal>) => Promise<void>;
  goal?: Goal | null;
  isCoach?: boolean;
  playerLevel?: PlayerLevel;
}

type Step = 'choice' | 'catalog' | 'form';

export function GoalForm({ open, onClose, onSave, goal, isCoach, playerLevel }: GoalFormProps) {
  const [step, setStep] = useState<Step>('form');
  const [fromTemplate, setFromTemplate] = useState(false);

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
    if (!open) return;
    if (goal) {
      setStep('form');
      setFromTemplate(false);
      setTitle(goal.title);
      setDescription(goal.description || '');
      setCategory(goal.category);
      setStatus(goal.status);
      setDeadline(goal.deadline || '');
      setProgress(goal.progress);
      setCoachNotes(goal.coach_notes || '');
    } else {
      setStep('choice');
      setFromTemplate(false);
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

  const handlePickTemplate = (tpl: GoalTemplate) => {
    setTitle(tpl.title);
    setDescription(tpl.description || '');
    setCategory(tpl.category);
    setStatus('planned');
    setDeadline('');
    setProgress(0);
    setCoachNotes('');
    setFromTemplate(true);
    setStep('form');
    setError('');
  };

  const handleStartCustom = () => {
    setTitle('');
    setDescription('');
    setCategory('tecnica');
    setStatus('planned');
    setDeadline('');
    setProgress(0);
    setCoachNotes('');
    setFromTemplate(false);
    setStep('form');
    setError('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Inserisci un titolo');
      return;
    }

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
        ...(status === 'completed' && !goal?.completed_at
          ? { completed_at: new Date().toISOString() }
          : {}),
      });
      onClose();
    } catch {
      setError('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions = Object.entries(CATEGORY_CONFIG).map(([k, v]) => ({
    value: k,
    label: v.label,
  }));

  const statusOptions = STATUS_COLUMNS.map((s) => ({
    value: s,
    label: STATUS_CONFIG[s].labelIt,
  }));

  const today = new Date().toISOString().split('T')[0];

  const modalTitle = goal
    ? 'Modifica obiettivo'
    : step === 'choice'
      ? 'Nuovo obiettivo'
      : step === 'catalog'
        ? 'Catalogo obiettivi'
        : fromTemplate
          ? 'Personalizza obiettivo'
          : 'Nuovo obiettivo';

  return (
    <Modal open={open} onClose={onClose} title={modalTitle}>
      {step === 'choice' && !goal ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-gray-500 -mt-1">
            Come vuoi creare il nuovo obiettivo?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ChoiceCard
              icon={<ClipboardList size={22} strokeWidth={1.5} />}
              title="Scegli dal catalogo"
              description="Parti da un obiettivo predefinito dal maestro."
              onClick={() => setStep('catalog')}
            />
            <ChoiceCard
              icon={<PencilLine size={22} strokeWidth={1.5} />}
              title="Crea il tuo"
              description="Scrivi un obiettivo da zero."
              onClick={handleStartCustom}
            />
          </div>
        </div>
      ) : step === 'catalog' && !goal ? (
        <GoalTemplatePicker
          defaultLevel={playerLevel}
          onSelect={handlePickTemplate}
          onBack={() => setStep('choice')}
          onCreateCustom={handleStartCustom}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {fromTemplate && !goal && (
            <button
              onClick={() => setStep('catalog')}
              className="self-start flex items-center gap-1.5 text-[12px] font-semibold text-[var(--club-blue)] hover:underline -mt-1"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Torna al catalogo
            </button>
          )}

          <Input
            label="Titolo"
            value={title}
            onChange={setTitle}
            required
            placeholder="Es. Migliorare il rovescio"
          />
          <Textarea
            label="Descrizione"
            value={description}
            onChange={setDescription}
            placeholder="Dettagli sull'obiettivo..."
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Categoria"
              value={category}
              onChange={(v) => setCategory(v as GoalCategory)}
              options={categoryOptions}
              required
            />
            <Select
              label="Stato"
              value={status}
              onChange={(v) => setStatus(v as GoalStatus)}
              options={statusOptions}
            />
          </div>

          <Input
            label="Scadenza"
            type="date"
            value={deadline}
            onChange={setDeadline}
            min={goal ? undefined : today}
          />

          {status === 'in_progress' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Progresso: {progress}%</label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                onChange={(e) => setProgress(parseInt(e.target.value))}
                className="w-full accent-[var(--club-blue)]"
              />
            </div>
          )}

          {isCoach && (
            <Textarea
              label="Note del maestro"
              value={coachNotes}
              onChange={setCoachNotes}
              placeholder="Note visibili all'allievo..."
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={onClose}>
              Annulla
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSubmit}>
              {goal ? 'Salva modifiche' : 'Crea obiettivo'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

interface ChoiceCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function ChoiceCard({ icon, title, description, onClick }: ChoiceCardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-gray-200 rounded-2xl p-4 min-h-[88px] flex items-start gap-3 hover:border-[var(--club-blue)] hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200"
    >
      <div className="w-11 h-11 rounded-xl bg-[var(--club-blue-light)] flex items-center justify-center text-[var(--club-blue)] shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 tracking-[-0.01em]">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </button>
  );
}
