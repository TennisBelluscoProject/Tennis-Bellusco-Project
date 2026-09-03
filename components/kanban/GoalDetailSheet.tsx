'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, CalendarDays, Check, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type { Goal, GoalStatus } from '@/lib/database.types';
import { CATEGORY_CONFIG, STATUS_CONFIG, withAlpha } from '@/lib/constants';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Field';
import { describeDeadline, deadlineColor, nextStatus, prevStatus } from './goal-utils';

interface GoalDetailSheetProps {
  goal: Goal | null;
  open: boolean;
  now: number;
  onClose: () => void;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
  onStatusChange: (goal: Goal, status: GoalStatus) => void;
  onProgressChange: (id: string, progress: number) => void;
}

/* ─────────────────────────────────────────────────────────────────────────
   Il foglio che si apre toccando un obiettivo.

   Qui sta tutto quello che prima stava sulla card e la ingombrava: testo per
   intero, note del maestro, cursore del progresso, e le tre azioni che si
   fanno di rado — modifica, elimina, riporta indietro. Sulla card resta solo
   quello che si guarda di continuo.
   ───────────────────────────────────────────────────────────────────────── */

export function GoalDetailSheet({
  goal,
  open,
  now,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onProgressChange,
}: GoalDetailSheetProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Il cursore si muove sotto il dito e scrive sul database solo quando lo si
  // lascia: mandare una richiesta a ogni pixel lo farebbe scattare.
  const [draftProgress, setDraftProgress] = useState(0);

  useEffect(() => {
    if (goal) setDraftProgress(goal.progress);
  }, [goal]);

  if (!goal) return null;

  const cat = CATEGORY_CONFIG[goal.category];
  const deadline = describeDeadline(goal.deadline, now);
  const next = nextStatus(goal.status);
  const back = prevStatus(goal.status);
  const isDone = goal.status === 'completed';

  const move = (status: GoalStatus) => {
    onStatusChange(goal, status);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} size="md">
        <div className="pt-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="badge" style={{ color: cat.color, backgroundColor: cat.bg }}>
              <CategoryIcon name={cat.icon} size={11} />
              {cat.label}
            </span>
            <span
              className="badge"
              style={{ color: STATUS_CONFIG[goal.status].color, backgroundColor: STATUS_CONFIG[goal.status].soft }}
            >
              {STATUS_CONFIG[goal.status].labelIt}
            </span>
            {goal.kids_objective_key && (
              <span className="badge bg-[var(--secondary)] text-muted-foreground">12 passi</span>
            )}
          </div>

          <h2 className="text-[19px] font-bold tracking-[-0.025em] leading-snug">{goal.title}</h2>

          {goal.description && (
            <p className="text-[14px] text-muted-foreground leading-relaxed mt-2 whitespace-pre-line">
              {goal.description}
            </p>
          )}

          {deadline && (
            <p
              className="flex items-center gap-1.5 text-[12.5px] font-semibold mt-3"
              style={{ color: deadlineColor(deadline.tone) }}
            >
              <CalendarDays size={13} strokeWidth={2.4} />
              {new Date(goal.deadline!).toLocaleDateString('it-IT', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              <span className="font-medium opacity-80">· {deadline.label}</span>
            </p>
          )}

          {goal.status === 'in_progress' && (
            <div className="mt-5 p-3.5 rounded-[var(--radius-lg)] bg-muted">
              <Slider
                label="A che punto sei"
                value={draftProgress}
                color={cat.color}
                onChange={setDraftProgress}
              />
              {draftProgress !== goal.progress && (
                <div className="flex justify-end mt-2.5">
                  <Button
                    size="sm"
                    onClick={() => onProgressChange(goal.id, draftProgress)}
                    icon={<Check size={14} strokeWidth={3} />}
                  >
                    Salva progresso
                  </Button>
                </div>
              )}
            </div>
          )}

          {goal.coach_notes && (
            <div
              className="mt-4 p-3.5 rounded-[var(--radius-lg)] border"
              style={{
                backgroundColor: 'var(--primary-soft)',
                borderColor: withAlpha('var(--primary)', 18),
              }}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-primary mb-1.5">
                Nota del maestro
              </p>
              <p className="text-[13.5px] text-foreground leading-relaxed whitespace-pre-line">
                {goal.coach_notes}
              </p>
            </div>
          )}

          {/* Spostamenti: prima quello in avanti, che e' il gesto di ogni
              giorno; il ritorno indietro sta accanto ma piu' spento. */}
          <div className="flex flex-wrap gap-2 mt-6">
            {next && (
              <Button
                variant={next === 'completed' ? 'success' : 'primary'}
                onClick={() => move(next)}
                icon={
                  next === 'completed' ? (
                    <Check size={15} strokeWidth={3} />
                  ) : (
                    <ArrowRight size={15} strokeWidth={2.6} />
                  )
                }
              >
                {next === 'completed' ? 'Segna come concluso' : `Sposta in ${STATUS_CONFIG[next].labelIt}`}
              </Button>
            )}
            {back && (
              <Button
                variant="outline"
                onClick={() => move(back)}
                icon={<RotateCcw size={14} strokeWidth={2.4} />}
              >
                {isDone ? 'Riapri' : `Torna in ${STATUS_CONFIG[back].labelIt}`}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 mt-3 pt-4 border-t border-border-soft">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onClose();
                onEdit(goal);
              }}
              icon={<Pencil size={14} />}
            >
              Modifica
            </Button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setConfirmDelete(true)}
              className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-[13px] font-semibold text-destructive hover:bg-destructive-soft transition-colors"
            >
              <Trash2 size={14} />
              Elimina
            </motion.button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminare questo obiettivo?"
        message={`"${goal.title}" verra' rimosso dalla scheda. L'operazione non si puo' annullare.`}
        confirmLabel="Elimina"
        onConfirm={() => {
          setConfirmDelete(false);
          onClose();
          onDelete(goal.id);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
