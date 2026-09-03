'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue } from 'motion/react';
import { CircleCheck, ClipboardList, Zap, type LucideIcon } from 'lucide-react';
import type { Goal, GoalCategory, GoalStatus } from '@/lib/database.types';
import { CATEGORY_CONFIG, STATUS_COLUMNS, STATUS_CONFIG, withAlpha } from '@/lib/constants';
import { useIsMobile } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Field';
import { GoalCard } from './kanban/GoalCard';
import { GoalDetailSheet } from './kanban/GoalDetailSheet';
import { nextStatus } from './kanban/goal-utils';

/* ═════════════════════════════════════════════════════════════════════════
   La bacheca degli obiettivi.

   Due regole valgono per tutta questa schermata.

   1. NIENTE RICARICAMENTI. Ogni spostamento si vede subito: chi chiama
      aggiorna la propria copia in memoria e scrive sul database in secondo
      piano. Prima si aspettava la risposta e si rileggeva tutto, ed e' da li'
      che veniva lo scatto a ogni trascinamento.

   2. UNO SPOSTAMENTO HA UN VERSO. La card non svanisce e ricompare: esce dal
      lato verso cui sta andando ed entra dal lato opposto nella colonna di
      destinazione. Il verso arriva da `direction`, deciso al momento dello
      spostamento e passato ad AnimatePresence tramite `custom` — che e'
      l'unico modo per farlo sapere a un elemento che sta gia' uscendo di
      scena, e quindi non ha piu' props aggiornabili.

   NOTA SU UN TENTATIVO FALLITO: prima le card condividevano un `layoutId` fra
   le colonne, cosi' motion le faceva volare da una all'altra. Non funziona
   qui: le colonne sono contenitori con `overflow-y: auto`, e una card in volo
   attraversa lo spazio FRA due colonne, cioe' fuori dal riquadro di entrambe.
   Veniva ritagliata a meta' traversata e il volo si vedeva come uno sfarfallio.
   Uscita ed entrata con un verso danno la stessa lettura senza uscire dai
   bordi.
   ═════════════════════════════════════════════════════════════════════════ */

const EMPTY_ICON: Record<GoalStatus, LucideIcon> = {
  planned: ClipboardList,
  in_progress: Zap,
  completed: CircleCheck,
};

const EMPTY_TEXT: Record<GoalStatus, string> = {
  planned: 'Niente in programma',
  in_progress: 'Niente in corso',
  completed: 'Ancora nessun obiettivo concluso',
};

/** Quanto dura la celebrazione prima che la card se ne vada davvero. */
const CELEBRATION_MS = 460;

/** Molla usata da tutti i movimenti delle card: un solo carattere di moto. */
const CARD_SPRING = { type: 'spring' as const, stiffness: 460, damping: 40, mass: 0.7 };

/**
 * Entrata e uscita di una card, con il verso dello spostamento.
 * `d > 0` = sta andando avanti (esce a destra, entra da sinistra).
 */
const CARD_VARIANTS = {
  enter: (d: number) => ({ opacity: 0, x: d > 0 ? -26 : 26, scale: 0.97 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (d: number) => ({
    opacity: 0,
    x: d > 0 ? 70 : -70,
    scale: 0.94,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export interface KanbanBoardProps {
  goals: Goal[];
  isCoach: boolean;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: GoalStatus) => void;
  onProgressChange: (id: string, progress: number) => void;
}

export function KanbanBoard({
  goals,
  onEdit,
  onDelete,
  onStatusChange,
  onProgressChange,
}: KanbanBoardProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [categoryFilter, setCategoryFilter] = useState<GoalCategory | ''>('');
  const [detail, setDetail] = useState<Goal | null>(null);
  const [celebrating, setCelebrating] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);

  // Un solo "adesso" per tutto il render: due card con la stessa scadenza
  // devono dire la stessa cosa anche se il render attraversa la mezzanotte.
  // La dipendenza e' `goals` di proposito.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => Date.now(), [goals]);

  const visible = useMemo(
    () => (categoryFilter ? goals.filter((g) => g.category === categoryFilter) : goals),
    [goals, categoryFilter]
  );

  const byStatus = useMemo(() => {
    const map: Record<GoalStatus, Goal[]> = { planned: [], in_progress: [], completed: [] };
    for (const g of visible) map[g.status].push(g);
    return map;
  }, [visible]);

  // Il foglio di dettaglio tiene un id, non l'oggetto: se l'obiettivo cambia
  // (progresso salvato, stato spostato) deve mostrare la versione nuova, non
  // quella congelata all'apertura.
  const detailGoal = detail ? goals.find((g) => g.id === detail.id) ?? null : null;

  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  const move = useCallback(
    (goal: Goal, to: GoalStatus) => {
      if (goal.status === to) return;
      const from = goal.status;
      const forward = STATUS_COLUMNS.indexOf(to) > STATUS_COLUMNS.indexOf(from);

      const commit = () => {
        setCelebrating(null);
        setDirection(forward ? 1 : -1);
        onStatusChange(goal.id, to);
        toast({
          message: goal.title,
          description: `Spostato in ${STATUS_CONFIG[to].labelIt}`,
          tone: to === 'completed' ? 'success' : 'default',
          onUndo: () => {
            setDirection(forward ? -1 : 1);
            onStatusChange(goal.id, from);
          },
        });
      };

      // Concludere qualcosa merita mezzo secondo di attenzione; gli altri
      // spostamenti sono di servizio e partono subito.
      if (to === 'completed') {
        setCelebrating(goal.id);
        timers.current.push(setTimeout(commit, CELEBRATION_MS));
      } else {
        commit();
      }
    },
    [onStatusChange, toast]
  );

  const advance = useCallback(
    (goal: Goal) => {
      const to = nextStatus(goal.status);
      if (to) move(goal, to);
    },
    [move]
  );

  const shared = {
    now,
    direction,
    onOpen: setDetail,
    onAdvance: advance,
    celebratingId: celebrating,
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {isMobile ? (
        <MobileBoard byStatus={byStatus} {...shared} />
      ) : (
        <DesktopBoard
          byStatus={byStatus}
          categoryFilter={categoryFilter}
          onCategoryFilter={setCategoryFilter}
          onMove={move}
          {...shared}
        />
      )}

      <GoalDetailSheet
        goal={detailGoal}
        open={!!detailGoal}
        now={now}
        onClose={() => setDetail(null)}
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusChange={move}
        onProgressChange={onProgressChange}
      />
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   Lista di card — condivisa da desktop e telefono
   ═════════════════════════════════════════════════════════════════════════ */

interface GoalListProps {
  goals: Goal[];
  direction: number;
  now: number;
  onOpen: (g: Goal) => void;
  onAdvance: (g: Goal) => void;
  celebratingId: string | null;
  /** Su desktop ogni card e' afferrabile: aggiunge gli attacchi di dnd-kit. */
  draggable?: boolean;
}

function GoalList({
  goals,
  direction,
  now,
  onOpen,
  onAdvance,
  celebratingId,
  draggable,
}: GoalListProps) {
  return (
    // `custom` su AnimatePresence e' l'unico canale che raggiunge un elemento
    // gia' rimosso dall'albero: senza, la card uscirebbe sempre nello stesso
    // verso, anche tornando indietro.
    //
    // Modo predefinito, NON `popLayout`. `popLayout` toglie l'elemento in
    // uscita dal flusso e lo posiziona in assoluto, e per farlo deve
    // rimisurarlo: dentro un contenitore che scorre, a sua volta dentro un
    // nastro trasformato, quelle misure arrivavano sbagliate e le card
    // superstiti scattavano. Qui l'elemento in uscita tiene il suo posto
    // mentre se ne va e poi lo cede: le altre scivolano grazie a `layout`,
    // senza nessuna misura da indovinare.
    <AnimatePresence initial={false} custom={direction}>
      {goals.map((goal) => (
        <motion.div
          key={goal.id}
          layout
          custom={direction}
          variants={CARD_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={CARD_SPRING}
          className="shrink-0"
        >
          {draggable ? (
            <DraggableCard
              goal={goal}
              now={now}
              onOpen={onOpen}
              onAdvance={onAdvance}
              celebrating={celebratingId === goal.id}
            />
          ) : (
            <GoalCard
              goal={goal}
              now={now}
              onOpen={onOpen}
              onAdvance={onAdvance}
              celebrating={celebratingId === goal.id}
            />
          )}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

function EmptyColumn({
  status,
  highlighted,
}: {
  status: GoalStatus;
  highlighted?: boolean;
}) {
  const Icon = EMPTY_ICON[status];
  return (
    <div
      className={cn(
        'flex-1 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] text-center px-4 py-10',
        'border border-dashed transition-colors duration-[var(--dur-base)]',
        highlighted ? 'border-[var(--primary-border)]' : 'border-transparent'
      )}
    >
      <Icon size={22} strokeWidth={1.6} className="text-subtle-foreground" />
      <p className="text-[12.5px] text-subtle-foreground">{EMPTY_TEXT[status]}</p>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   DESKTOP — tre colonne, trascinamento con @dnd-kit
   ═════════════════════════════════════════════════════════════════════════ */

interface BoardShared {
  byStatus: Record<GoalStatus, Goal[]>;
  direction: number;
  now: number;
  onOpen: (g: Goal) => void;
  onAdvance: (g: Goal) => void;
  celebratingId: string | null;
}

function DesktopBoard({
  byStatus,
  direction,
  now,
  onOpen,
  onAdvance,
  celebratingId,
  categoryFilter,
  onCategoryFilter,
  onMove,
}: BoardShared & {
  categoryFilter: GoalCategory | '';
  onCategoryFilter: (c: GoalCategory | '') => void;
  onMove: (goal: Goal, to: GoalStatus) => void;
}) {
  const [dragged, setDragged] = useState<Goal | null>(null);

  // La soglia di 6px e' quella che tiene insieme le due cose: sotto e' un
  // clic (e apre il dettaglio), sopra e' un trascinamento. Senza, ogni clic
  // farebbe partire un drag da zero pixel e la card non si aprirebbe mai.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const all = useMemo(
    () => [...byStatus.planned, ...byStatus.in_progress, ...byStatus.completed],
    [byStatus]
  );

  const handleStart = (e: DragStartEvent) => {
    setDragged(all.find((g) => g.id === e.active.id) ?? null);
  };

  const handleEnd = (e: DragEndEvent) => {
    const goal = dragged;
    setDragged(null);
    if (!goal || !e.over) return;
    const to = e.over.id as GoalStatus;
    if (STATUS_COLUMNS.includes(to)) onMove(goal, to);
  };

  const categoryOptions = [
    { value: '', label: 'Tutte le categorie' },
    ...Object.entries(CATEGORY_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
  ];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setDragged(null)}
    >
      <div className="mb-4 flex items-center gap-3">
        <Select
          value={categoryFilter}
          onChange={(v) => onCategoryFilter(v as GoalCategory | '')}
          options={categoryOptions}
          className="w-[220px]"
        />
        {categoryFilter && (
          <span className="text-[12.5px] text-muted-foreground tnum">
            {all.length} obiettivi
          </span>
        )}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {STATUS_COLUMNS.map((status) => (
          <Column
            key={status}
            status={status}
            goals={byStatus[status]}
            direction={direction}
            now={now}
            onOpen={onOpen}
            onAdvance={onAdvance}
            celebratingId={celebratingId}
            dragging={!!dragged}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
        {dragged && (
          <GoalCard goal={dragged} now={now} onOpen={() => {}} onAdvance={() => {}} overlay />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  goals,
  direction,
  now,
  onOpen,
  onAdvance,
  celebratingId,
  dragging,
}: {
  status: GoalStatus;
  goals: Goal[];
  direction: number;
  now: number;
  onOpen: (g: Goal) => void;
  onAdvance: (g: Goal) => void;
  celebratingId: string | null;
  dragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = STATUS_CONFIG[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 min-w-[268px] rounded-[var(--radius-xl)] p-2.5 flex flex-col',
        'transition-colors duration-[var(--dur-base)]',
        'h-[calc(100dvh-340px)] min-h-[400px] max-h-[760px]',
        isOver ? 'drop-target' : 'bg-[var(--sunken)]'
      )}
    >
      <div className="flex items-center justify-between mb-2.5 px-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: config.color }}
            aria-hidden
          />
          <h3 className="text-[12.5px] font-bold tracking-[-0.01em]">{config.labelIt}</h3>
        </div>
        <CountPill count={goals.length} color={config.color} soft={config.soft} />
      </div>

      {/* `layoutScroll`: contenitore che scorre con dentro elementi che
          animano la posizione. Senza, dopo aver scrollato la lista ogni
          rimozione fa saltare le card superstiti. */}
      <motion.div
        layoutScroll
        className="kanban-col-scroll flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1"
      >
        {goals.length === 0 && <EmptyColumn status={status} highlighted={dragging} />}
        <GoalList
          goals={goals}
          direction={direction}
          now={now}
          onOpen={onOpen}
          onAdvance={onAdvance}
          celebratingId={celebratingId}
          draggable
        />
      </motion.div>
    </div>
  );
}

function DraggableCard({
  goal,
  now,
  onOpen,
  onAdvance,
  celebrating,
}: {
  goal: Goal;
  now: number;
  onOpen: (g: Goal) => void;
  onAdvance: (g: Goal) => void;
  celebrating: boolean;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: goal.id });

  return (
    // Gli ascoltatori stanno sul contenitore, non sulla card: cosi' si puo'
    // afferrare da qualunque punto. `touch-none` serve a dnd-kit per non
    // farsi rubare il gesto dallo scorrimento della colonna.
    <div ref={setNodeRef} {...attributes} {...listeners} className="touch-none">
      <GoalCard
        goal={goal}
        now={now}
        onOpen={onOpen}
        onAdvance={onAdvance}
        showGrip
        isDragging={isDragging}
        celebrating={celebrating}
      />
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   TELEFONO — tre pannelli che scorrono sotto il dito
   ═════════════════════════════════════════════════════════════════════════ */

function MobileBoard({
  byStatus,
  direction,
  now,
  onOpen,
  onAdvance,
  celebratingId,
}: BoardShared) {
  const [index, setIndex] = useState(1); // si apre su "In corso"
  const trackRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const x = useMotionValue(0);

  // La larghezza serve per far scorrere il nastro: la si misura invece di
  // stimarla, cosi' funziona anche in orizzontale o su schermo diviso.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const clamped = Math.min(STATUS_COLUMNS.length - 1, Math.max(0, i));
      setIndex(clamped);
      animate(x, -clamped * width, { type: 'spring', stiffness: 420, damping: 42, mass: 0.7 });
    },
    [x, width]
  );

  // Riallineamento SOLO quando cambia la larghezza (primo calcolo, rotazione,
  // schermo diviso). Due dettagli, entrambi bug veri risolti qui:
  //
  //   - dipende solo dalla larghezza. Prima dipendeva anche da `index`, quindi
  //     a ogni cambio di scheda rifaceva `x.set()` subito dopo il render e
  //     uccideva l'animazione appena lanciata da goTo;
  //   - e' un effetto di LAYOUT, non normale. La misura arriva da un
  //     useLayoutEffect, ma il riposizionamento avveniva dopo la pittura: si
  //     vedeva per un fotogramma la colonna "In programma" e poi uno scatto su
  //     "In corso". Ora accade prima che il browser disegni.
  const lastWidth = useRef(0);
  useLayoutEffect(() => {
    if (width === lastWidth.current) return;
    lastWidth.current = width;
    x.set(-index * width);
  }, [width, index, x]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <StatusSwitcher byStatus={byStatus} index={index} onSelect={goTo} />

      <div ref={trackRef} className="flex-1 min-h-0 overflow-hidden mt-3">
        <motion.div
          className="flex h-full"
          // `touch-action: pan-y` lascia lo scorrimento verticale al browser e
          // tiene l'orizzontale per noi. Con questo NON serve
          // `dragDirectionLock`, che aggiungeva solo una soglia di
          // riconoscimento e rendeva molli i primi pixel del gesto.
          style={{ x, width: width * STATUS_COLUMNS.length, touchAction: 'pan-y' }}
          layoutRoot
          drag="x"
          dragConstraints={{ left: -(STATUS_COLUMNS.length - 1) * width, right: 0 }}
          dragElastic={0.14}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            // Conta la distanza ma anche la velocita': un colpetto corto e
            // rapido e' il gesto che si fa davvero, e pretendere solo la
            // distanza farebbe sembrare il nastro incollato.
            const far = Math.abs(info.offset.x) > width * 0.2;
            const fast = Math.abs(info.velocity.x) > 360;
            if (!far && !fast) return goTo(index);
            goTo(info.offset.x < 0 ? index + 1 : index - 1);
          }}
        >
          {STATUS_COLUMNS.map((status) => (
            <MobilePanel key={status} width={width}>
              {byStatus[status].length === 0 && (
                <div className="h-full flex items-center justify-center">
                  <EmptyColumn status={status} />
                </div>
              )}
              <div className="flex flex-col gap-2 px-0.5">
                <GoalList
                  goals={byStatus[status]}
                  direction={direction}
                  now={now}
                  onOpen={onOpen}
                  onAdvance={onAdvance}
                  celebratingId={celebratingId}
                />
              </div>
            </MobilePanel>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function MobilePanel({ width, children }: { width: number; children: ReactNode }) {
  return (
    <motion.div
      layoutScroll
      style={{ width }}
      className="shrink-0 h-full overflow-y-auto overscroll-contain scrollbar-hidden pb-24"
    >
      {children}
    </motion.div>
  );
}

/**
 * Pastiglia con il conteggio.
 *
 * Il `key` sul valore e' voluto: cambiando numero l'elemento viene ricreato e
 * l'animazione di entrata riparte. E' il modo piu' semplice per far "scattare"
 * un contatore quando ci arriva qualcosa.
 */
function CountPill({ count, color, soft }: { count: number; color: string; soft: string }) {
  return (
    <motion.span
      key={count}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 620, damping: 24 }}
      className="text-[11px] font-bold tnum rounded-full px-2 py-0.5 min-w-[22px] text-center"
      style={{ backgroundColor: soft, color }}
    >
      {count}
    </motion.span>
  );
}

/**
 * Selettore degli stati su telefono.
 *
 * Non usa il controllo segmentato generico perche' qui il contatore deve
 * reagire: quando un obiettivo arriva, il numero della scheda di destinazione
 * scatta. E' il segnale che dice "e' finito li'" a chi e' rimasto fermo su
 * un'altra scheda.
 */
function StatusSwitcher({
  byStatus,
  index,
  onSelect,
}: {
  byStatus: Record<GoalStatus, Goal[]>;
  index: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="shrink-0">
      <LayoutGroup id="kanban-mobile-tabs">
        <div
          role="tablist"
          className="flex gap-1 p-1 rounded-[var(--radius-lg)] bg-muted border border-border-soft"
        >
          {STATUS_COLUMNS.map((status, i) => {
            const config = STATUS_CONFIG[status];
            const count = byStatus[status].length;
            const active = i === index;

            return (
              <button
                key={status}
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(i)}
                className="relative flex-1 min-w-0 flex items-center justify-center gap-1.5 px-1.5 py-2 rounded-[var(--radius-md)] text-[12.5px] font-semibold"
              >
                {active && (
                  <motion.span
                    layoutId="mobile-status-pill"
                    transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                    className="absolute inset-0 rounded-[var(--radius-md)] bg-card shadow-[var(--shadow-sm)]"
                  />
                )}
                <span
                  className={cn('relative z-10 truncate', !active && 'text-muted-foreground')}
                  style={active ? { color: config.color } : undefined}
                >
                  {config.short}
                </span>
                <motion.span
                  key={count}
                  initial={{ scale: 0.55 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 640, damping: 22 }}
                  className="relative z-10 text-[10px] font-bold tnum rounded-full px-1.5 py-0.5 leading-none min-w-[17px] text-center"
                  style={
                    active
                      ? { backgroundColor: config.color, color: 'var(--primary-foreground)' }
                      : { backgroundColor: 'var(--secondary)', color: 'var(--muted-foreground)' }
                  }
                >
                  {count}
                </motion.span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      <div className="flex justify-center gap-1.5 mt-2.5">
        {STATUS_COLUMNS.map((status, i) => (
          <motion.span
            key={status}
            animate={{ width: i === index ? 16 : 5 }}
            transition={{ type: 'spring', stiffness: 480, damping: 34 }}
            className="h-[3px] rounded-full block"
            style={{
              backgroundColor:
                i === index ? STATUS_CONFIG[status].color : withAlpha('var(--muted-foreground)', 28),
            }}
          />
        ))}
      </div>
    </div>
  );
}
