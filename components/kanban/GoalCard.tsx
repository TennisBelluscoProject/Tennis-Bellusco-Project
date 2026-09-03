'use client';

import { memo, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Check, GripVertical, MessageSquare } from 'lucide-react';
import type { Goal, GoalStatus } from '@/lib/database.types';
import { CATEGORY_CONFIG, STATUS_CONFIG, withAlpha } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ProgressBar } from '@/components/ui/Feedback';
import { describeDeadline, deadlineColor, nextStatus } from './goal-utils';

export interface GoalCardProps {
  goal: Goal;
  now: number;
  /** Apre il foglio di dettaglio (modifica, elimina, torna indietro). */
  onOpen: (goal: Goal) => void;
  /** Manda l'obiettivo nella colonna successiva. */
  onAdvance: (goal: Goal) => void;
  /** Mostra la presa di trascinamento (solo desktop). */
  showGrip?: boolean;
  isDragging?: boolean;
  /** true nell'anteprima che segue il cursore. */
  overlay?: boolean;
  /** Sta suonando l'animazione di completamento. */
  celebrating?: boolean;
}

/* ─────────────────────────────────────────────────────────────────────────
   La card di un obiettivo.

   Una riga, non un riquadro: filetto della categoria, cosa c'e' da fare,
   quanto manca, e a destra un solo pulsante che la manda avanti. Tutto il
   resto — modifica, elimina, torna indietro, note del maestro per intero —
   vive nel foglio che si apre toccandola. Cosi' la lista resta scorrevole e
   non c'e' una fila di icone grigie sotto ogni obiettivo.
   ───────────────────────────────────────────────────────────────────────── */

export const GoalCard = memo(function GoalCard({
  goal,
  now,
  onOpen,
  onAdvance,
  showGrip,
  isDragging,
  overlay,
  celebrating,
}: GoalCardProps) {
  const cat = CATEGORY_CONFIG[goal.category];
  const deadline = describeDeadline(goal.deadline, now);
  const next = nextStatus(goal.status);
  const isDone = goal.status === 'completed';
  const showProgress = goal.status === 'in_progress';

  return (
    // Elemento SEMPLICE, non animato: entrata, uscita e riposizionamento li
    // gestisce il contenitore in KanbanBoard. Due sorgenti di `transform`
    // sullo stesso nodo (una di motion, una di una transizione CSS) si
    // combattono, ed e' cosi' che nascono i tremolii.
    <div
      className={cn(
        'goal-card group relative w-full text-left overflow-hidden',
        'bg-card border border-border rounded-[var(--radius-lg)]',
        'transition-[border-color,box-shadow] duration-[var(--dur-base)]',
        overlay
          ? 'shadow-[var(--shadow-drag)] rotate-[1.4deg] cursor-grabbing'
          : 'shadow-[var(--shadow-xs)] hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]',
        isDragging && 'opacity-30',
        isDone && 'bg-[var(--muted)] border-transparent'
      )}
      style={{ '--cat-color': isDone ? 'var(--success)' : cat.color } as CSSProperties}
    >
      <div className="flex items-center gap-2.5 pl-3.5 pr-2 py-3">
        {showGrip && (
          <span
            className="hidden md:flex items-center self-stretch -ml-1.5 text-[var(--border-strong)] opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden
          >
            <GripVertical size={14} />
          </span>
        )}

        <button
          type="button"
          onClick={() => onOpen(goal)}
          className="flex-1 min-w-0 text-left rounded-[var(--radius-xs)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="badge shrink-0"
              style={{
                color: isDone ? 'var(--success)' : cat.color,
                backgroundColor: isDone ? 'var(--success-soft)' : cat.bg,
              }}
            >
              <CategoryIcon name={cat.icon} size={11} />
              {cat.label}
            </span>

            {goal.kids_objective_key && (
              <span className="badge shrink-0 bg-[var(--secondary)] text-muted-foreground">
                12 passi
              </span>
            )}

            {deadline && !isDone && (
              <span
                className="text-[11px] font-semibold shrink-0 ml-auto"
                style={{ color: deadlineColor(deadline.tone) }}
              >
                {deadline.label}
              </span>
            )}

            {isDone && goal.completed_at && (
              <span className="text-[11px] font-medium text-subtle-foreground shrink-0 ml-auto">
                {new Date(goal.completed_at).toLocaleDateString('it-IT', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            )}
          </div>

          <p
            className={cn(
              'text-[14px] font-semibold tracking-[-0.012em] truncate',
              isDone
                ? 'text-muted-foreground line-through decoration-[var(--border-strong)]'
                : 'text-foreground'
            )}
          >
            {goal.title}
          </p>

          {goal.description && !isDone && (
            <p className="text-[12.5px] text-muted-foreground truncate mt-0.5">{goal.description}</p>
          )}

          {showProgress && (
            <div className="flex items-center gap-2.5 mt-2">
              <ProgressBar
                value={goal.progress}
                color={cat.color}
                height={4}
                className="flex-1"
              />
              <span className="text-[11px] font-bold tnum shrink-0" style={{ color: cat.color }}>
                {goal.progress}%
              </span>
            </div>
          )}

          {goal.coach_notes && !isDone && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-medium text-primary">
              <MessageSquare size={10} strokeWidth={2.6} />
              Nota del maestro
            </span>
          )}
        </button>

        {next ? (
          <AdvanceButton status={next} color={cat.color} onClick={() => onAdvance(goal)} />
        ) : (
          <span
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}
            aria-hidden
          >
            <Check size={16} strokeWidth={3} />
          </span>
        )}
      </div>

      <CompletionOverlay show={!!celebrating} />
    </div>
  );
});

/**
 * Il pulsante che manda avanti.
 *
 * Cambia faccia in base a dove porta: freccia per iniziare, spunta per
 * concludere. Due gesti diversi meritano due segni diversi, altrimenti
 * concludere un obiettivo pesa quanto spostarlo di una casella.
 */
function AdvanceButton({
  status,
  color,
  onClick,
}: {
  status: GoalStatus;
  color: string;
  onClick: () => void;
}) {
  const done = status === 'completed';
  const accent = done ? 'var(--success)' : color;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      // Ferma il pointerdown PRIMA che risalga.
      //
      // Sopra questa card ci sono due gestori di trascinamento: il nastro
      // orizzontale su telefono e dnd-kit su desktop. Entrambi ascoltano il
      // pointerdown sull'antenato, quindi premendo questo pulsante partiva
      // anche un trascinamento: il dito si sposta di due pixel, il nastro
      // scivola, poi rimbalza indietro mentre la card se ne va. Da fuori
      // sembrava che il pulsante "glitchasse".
      onPointerDownCapture={(e) => e.stopPropagation()}
      whileTap={{ scale: 0.85 }}
      whileHover={{ scale: 1.06 }}
      transition={{ type: 'spring', stiffness: 600, damping: 24 }}
      aria-label={`Sposta in ${STATUS_CONFIG[status].labelIt}`}
      title={`Sposta in ${STATUS_CONFIG[status].labelIt}`}
      className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center border transition-colors duration-[var(--dur-base)]"
      style={{
        borderColor: withAlpha(accent, 32),
        backgroundColor: withAlpha(accent, 10),
        color: accent,
      }}
    >
      {done ? <Check size={16} strokeWidth={3} /> : <ArrowRight size={16} strokeWidth={2.6} />}
    </motion.button>
  );
}

/**
 * Il momento in cui un obiettivo viene concluso.
 *
 * Una lama di verde attraversa la card e lascia una spunta che si disegna da
 * sola. Dura meno di mezzo secondo, ma e' l'unico punto dell'app in cui
 * qualcosa viene portato a termine: valeva la pena vederlo.
 */
function CompletionOverlay({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          style={{ backgroundColor: withAlpha('var(--success)', 14) }}
        >
          <motion.span
            initial={{ x: '-110%' }}
            animate={{ x: '110%' }}
            transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-y-0 w-1/3"
            style={{
              background: `linear-gradient(90deg, transparent, ${withAlpha('var(--success)', 34)}, transparent)`,
            }}
          />
          <motion.svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 20, delay: 0.06 }}
          >
            <path
              d="M20 6L9 17l-5-5"
              stroke="var(--success)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="draw-check"
            />
          </motion.svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
