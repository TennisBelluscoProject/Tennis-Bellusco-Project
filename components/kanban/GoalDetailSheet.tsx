'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, CalendarDays, Check, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import type { Goal, GoalStatus } from '@/lib/database.types';
import { CATEGORY_CONFIG, STATUS_CONFIG, withAlpha } from '@/lib/constants';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import { Button, IconButton } from '@/components/ui/Button';
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
  // lascia: mandare una richiesta a ogni scatto lo farebbe singhiozzare, e le
  // risposte potrebbero anche tornare in ordine sparso. Da qui la copia
  // locale, che segue il dito senza aspettare nessuno.
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
      {/* `hideClose`: la X la mette questo foglio, non il Dialog.

          Il Dialog disegna la propria X in una fascia sua, in cima. Qui pero'
          non c'e' nessun titolo da metterle accanto, quindi quella fascia
          restava una riga vuota con una X appesa a destra, e le pastiglie
          della categoria cominciavano solo sotto: due righe per una sola
          informazione, e la X che non sembrava appartenere a niente. Messa in
          fondo alla riga delle pastiglie occupa spazio gia' speso e si allinea
          a qualcosa. */}
      <Dialog open={open} onClose={onClose} size="md" hideClose>
        <div className="pt-4">
          <div className="flex items-start gap-2 mb-3">
            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
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
            <IconButton
              label="Chiudi"
              size={30}
              onClick={onClose}
              icon={<X size={16} />}
              className="-mr-1 -mt-1 shrink-0"
            />
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
              {/* Nessun pulsante di conferma: il valore si salva da se'
                  appena si lascia il cursore.

                  Il pulsante compariva solo dopo aver mosso il cursore, cioe'
                  spuntava sotto al dito proprio mentre si stava guardando
                  altrove, e spostava il resto del foglio verso il basso. Ma
                  soprattutto chiedeva di confermare una cosa che non ha
                  bisogno di conferma: la percentuale e' gia' visibile mentre
                  si sceglie, non c'e' niente da rileggere prima di accettarla,
                  e il ripensamento e' semplicemente rimuovere il cursore.

                  `onCommit` scatta alla fine del gesto e non a ogni scatto:
                  una sola scrittura per spostamento (vedi Slider). */}
              <Slider
                label="A che punto sei"
                value={draftProgress}
                color={cat.color}
                onChange={setDraftProgress}
                onCommit={(v) => {
                  if (v !== goal.progress) onProgressChange(goal.id, v);
                }}
              />
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
              giorno; il ritorno indietro sta accanto ma piu' spento.

              I due pulsanti occupano tutta la riga, in parti uguali. Prima
              erano larghi quanto la loro etichetta e appoggiati a sinistra:
              siccome le etichette cambiano con lo stato dell'obiettivo
              ("Riapri" e' corto, "Torna in In programma" e' lungo), la coppia
              finiva ogni volta a una larghezza diversa e lasciava un vuoto
              irregolare sulla destra del foglio. Nessun altro dialogo dell'app
              fa cosi': quello della tappa (components/PathTreeView.tsx) usa da
              sempre `block`.

              In colonna sotto i 640px, perche' li' il foglio e' stretto e due
              etichette lunghe affiancate si ridurrebbero a due francobolli
              proprio dove si tocca col pollice. */}
          <div className="flex flex-col sm:flex-row gap-2 mt-6">
            {next && (
              <Button
                className="sm:flex-1"
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
                className="sm:flex-1"
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
