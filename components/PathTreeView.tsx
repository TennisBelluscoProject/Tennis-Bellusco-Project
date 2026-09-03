'use client';

/**
 * PathTreeView — vista "Il mio percorso" (skill tree).
 *
 * Componente PRESENTAZIONALE (sullo stile di KanbanBoard, nessuna dipendenza
 * dal data layer). Riceve nodi/archi/stati via props e le azioni come callback.
 *
 * La disposizione (livello di ogni nodo) e lo stato bloccato/sbloccato NON sono
 * dati salvati: vengono CALCOLATI da `computePathState` (algoritmo di Kahn,
 * O(V+E), vedi lib/paths/topo.ts) a ogni render. Kanban e Percorso sono cosi'
 * due viste degli stessi dati.
 *
 * LAYOUT MOBILE-FIRST: i livelli sono righe a flusso (flex + wrap), quindi le
 * card non si sovrappongono mai, nemmeno con 3+ tappe nello stesso livello su
 * schermi stretti. I connettori dei prerequisiti sono disegnati in un overlay
 * SVG sulle posizioni REALI delle card (misurate con ResizeObserver), cosi'
 * restano corretti a qualunque larghezza.
 *
 * Quando un nodo viene completato e il ricalcolo sblocca nuovi nodi, questi
 * ricevono una breve animazione di sblocco (classe .animate-unlock).
 *
 * La stessa vista serve all'allievo e all'anteprima dell'editor (`isPreview`):
 * il maestro progetta guardando esattamente quello che vedra' chi gioca.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion } from 'motion/react';
import { Check, Info, Lock, Play, Trophy, X } from 'lucide-react';
import type { GoalCategory, GoalStatus, PlayerLevel } from '@/lib/database.types';
import { CATEGORY_CONFIG, withAlpha } from '@/lib/constants';
import { computePathState, type NodeId } from '@/lib/paths/topo';
import { cn } from '@/lib/utils';
import { Badge, ProgressBar } from './ui/Feedback';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Slider } from './ui/Field';
import { CategoryIcon } from './CategoryIcon';

// ─── View-model ─────────────────────────────────────────────────────────────

export interface PathTreeNode {
  id: NodeId;
  title: string;
  category: GoalCategory;
  description?: string | null;
  /** Stato del goal materializzato; null = non ancora materializzato. */
  status: GoalStatus | null;
  /** 0..100, usato solo se status === 'in_progress'. */
  progress?: number;
  /** Id del goal materializzato (serve per le azioni). */
  goalId?: string;
}

export interface PathTreeData {
  title: string;
  difficulty: PlayerLevel;
  nodes: PathTreeNode[];
  edges: { from: NodeId; to: NodeId }[];
}

interface PathTreeViewProps {
  data: PathTreeData;
  /** Anteprima/sola-lettura: mostra un banner e disabilita le azioni. */
  isPreview?: boolean;
  /** Azioni sul goal del nodo (assenti in anteprima). */
  onStart?: (goalId: string) => void;
  onProgress?: (goalId: string, value: number) => void;
  onComplete?: (goalId: string) => void;
  /**
   * Solo maestro: disattiva il percorso per QUESTO allievo (rimuove anche gli
   * obiettivi materializzati). Se presente, l'header mostra il pulsante.
   */
  onDeactivate?: () => void;
}

type VisualState = 'locked' | 'available' | 'in_progress' | 'completed';

// ─── Geometria dei connettori (misurata sul DOM reale) ──────────────────────

interface NodeGeom {
  cx: number; // centro orizzontale, relativo al contenitore
  top: number;
  bottom: number;
}

// ─── Componente principale ───────────────────────────────────────────────────

export function PathTreeView({
  data,
  isPreview,
  onStart,
  onProgress,
  onComplete,
  onDeactivate,
}: PathTreeViewProps) {
  const [selectedId, setSelectedId] = useState<NodeId | null>(null);

  // 1) Algoritmo: ordine topologico + layering + frontiera sbloccata.
  const completion = useMemo(
    () => new Set(data.nodes.filter((n) => n.status === 'completed').map((n) => n.id)),
    [data.nodes]
  );
  const state = useMemo(
    () => computePathState(data.nodes.map((n) => ({ id: n.id })), data.edges, completion),
    [data.nodes, data.edges, completion]
  );

  const byId = useMemo(() => {
    const m = new Map<NodeId, PathTreeNode>();
    for (const n of data.nodes) m.set(n.id, n);
    return m;
  }, [data.nodes]);

  // 2) Raggruppa i nodi per livello (layer) → righe dell'albero.
  const layers = useMemo(() => {
    const maxLayer = data.nodes.reduce((mx, n) => Math.max(mx, state.layer[n.id] ?? 0), 0);
    const rows: PathTreeNode[][] = Array.from({ length: maxLayer + 1 }, () => []);
    for (const n of data.nodes) rows[state.layer[n.id] ?? 0].push(n);
    return rows;
  }, [data.nodes, state.layer]);

  // 3) Misura le posizioni reali delle card per disegnare i connettori SVG.
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<NodeId, HTMLDivElement>());
  const [geom, setGeom] = useState<Record<NodeId, NodeGeom>>({});
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });

  const setNodeRef = useCallback(
    (id: NodeId) => (el: HTMLDivElement | null) => {
      if (el) nodeRefs.current.set(id, el);
      else nodeRefs.current.delete(id);
    },
    []
  );

  const measure = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const cr = c.getBoundingClientRect();
    const g: Record<NodeId, NodeGeom> = {};
    nodeRefs.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      g[id] = {
        cx: r.left - cr.left + r.width / 2,
        top: r.top - cr.top,
        bottom: r.top - cr.top + r.height,
      };
    });
    setGeom(g);
    setCanvas({ w: c.clientWidth, h: c.scrollHeight });
  }, []);

  useLayoutEffect(() => {
    measure();
    const c = containerRef.current;
    if (!c || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(c);
    return () => ro.disconnect();
  }, [measure, data]);

  // 4) Animazione di sblocco: marca i nodi appena passati da bloccato a sbloccato.
  const prevUnlocked = useRef<Record<NodeId, boolean> | null>(null);
  const [justUnlocked, setJustUnlocked] = useState<Set<NodeId>>(new Set());
  useEffect(() => {
    const prev = prevUnlocked.current;
    if (prev) {
      const newly = new Set<NodeId>();
      for (const n of data.nodes) {
        if (state.unlocked[n.id] && prev[n.id] === false) newly.add(n.id);
      }
      if (newly.size > 0) {
        setJustUnlocked(newly);
        const t = setTimeout(() => setJustUnlocked(new Set()), 900);
        prevUnlocked.current = state.unlocked;
        return () => clearTimeout(t);
      }
    }
    prevUnlocked.current = state.unlocked;
  }, [state.unlocked, data.nodes]);

  const completed = data.nodes.filter((n) => n.status === 'completed').length;
  const total = data.nodes.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const visualOf = (n: PathTreeNode): VisualState => {
    if (n.status === 'completed') return 'completed';
    if (n.status === 'in_progress') return 'in_progress';
    return state.unlocked[n.id] ? 'available' : 'locked';
  };

  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  // Il foglio deve poter USCIRE con la sua animazione: se lo smontassimo
  // nell'istante in cui la selezione torna a null, sparirebbe di colpo. Si
  // tiene quindi l'ultima tappa mostrata e si comanda solo l'apertura.
  const lastShown = useRef<PathTreeNode | null>(null);
  if (selected) lastShown.current = selected;
  const sheetNode = selected ?? lastShown.current;

  return (
    <div className="flex flex-col">
      {/* Testata: titolo e avanzamento */}
      <div className="shrink-0 card p-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[16px] font-bold tracking-[-0.02em] truncate">{data.title}</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5 tnum">
              {completed} di {total} tappe completate
            </p>
          </div>
          <Badge color="var(--primary)" bg="var(--primary-soft)">
            {data.difficulty}
          </Badge>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <ProgressBar value={pct} color="var(--primary)" height={7} className="flex-1" />
          <span className="text-[12px] font-bold tnum w-9 text-right text-primary">{pct}%</span>
        </div>

        {onDeactivate && !isPreview && (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeactivate}
              icon={<X size={13} strokeWidth={2.6} />}
              className="text-destructive hover:bg-destructive-soft hover:text-destructive -ml-2"
            >
              Disattiva percorso per questo allievo
            </Button>
          </div>
        )}
      </div>

      {isPreview && (
        <div className="shrink-0 mb-3 flex items-center gap-2 text-[12px] text-primary bg-primary-soft border border-[var(--primary-border)] rounded-[var(--radius-lg)] px-3 py-2.5">
          <Info size={14} strokeWidth={2.2} className="shrink-0" />
          Anteprima della struttura: le azioni sono disattivate.
        </div>
      )}

      {/* Albero: altezza naturale, scorre insieme al contenitore/pagina */}
      <div className="pb-6">
        <div ref={containerRef} className="relative mx-auto w-full max-w-[560px]">
          {/* Connettori SVG dei prerequisiti, sulle posizioni misurate */}
          {canvas.h > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none"
              width={canvas.w}
              height={canvas.h}
              viewBox={`0 0 ${canvas.w} ${canvas.h}`}
              aria-hidden="true"
            >
              {data.edges.map((e, i) => {
                const a = geom[e.from];
                const b = geom[e.to];
                if (!a || !b) return null;
                const x1 = a.cx;
                const y1 = a.bottom + 2;
                const x2 = b.cx;
                const y2 = b.top - 2;
                const dy = Math.max(18, (y2 - y1) / 2);
                const toUnlocked = state.unlocked[e.to];
                const fromDone = completion.has(e.from);
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`}
                    fill="none"
                    stroke={
                      toUnlocked
                        ? fromDone
                          ? 'var(--success)'
                          : 'var(--primary)'
                        : 'var(--border-strong)'
                    }
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray={toUnlocked ? undefined : '4 5'}
                    strokeOpacity={toUnlocked ? 0.55 : 0.9}
                  />
                );
              })}
            </svg>
          )}

          {/* Livelli: righe a flusso, le card non si sovrappongono mai */}
          <div className="relative flex flex-col">
            {layers.map((row, li) => (
              <div key={li} className="py-2">
                {layers.length > 1 && (
                  <div className="path-level-label px-6 mb-3">Livello {li + 1}</div>
                )}
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-4 px-1">
                  {row.map((n) => (
                    <div
                      key={n.id}
                      ref={setNodeRef(n.id)}
                      className={cn(
                        'w-[180px] max-w-[46%] min-w-[150px]',
                        justUnlocked.has(n.id) && 'animate-unlock'
                      )}
                    >
                      <NodeCard node={n} visual={visualOf(n)} onTap={() => setSelectedId(n.id)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <NodeSheet
        node={sheetNode}
        open={!!selected}
        visual={sheetNode ? visualOf(sheetNode) : 'locked'}
        blockedBy={
          sheetNode
            ? state.blockedBy[sheetNode.id]?.map((id) => byId.get(id)?.title ?? id) ?? []
            : []
        }
        isPreview={isPreview}
        onStart={onStart}
        onProgress={onProgress}
        onComplete={onComplete}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

// ─── Card del singolo nodo ───────────────────────────────────────────────────

function NodeCard({
  node,
  visual,
  onTap,
}: {
  node: PathTreeNode;
  visual: VisualState;
  onTap: () => void;
}) {
  const cat = CATEGORY_CONFIG[node.category];

  const shell =
    'w-full h-full text-left rounded-[var(--radius-lg)] p-3 transition-[border-color,box-shadow] duration-[var(--dur-base)]';

  if (visual === 'locked') {
    return (
      <motion.button
        onClick={onTap}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 600, damping: 26 }}
        className={cn(shell, 'border border-dashed border-[var(--border-strong)] bg-muted')}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="w-7 h-7 rounded-full bg-[var(--secondary)] text-subtle-foreground flex items-center justify-center shrink-0">
            <Lock size={13} strokeWidth={2.2} />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-subtle-foreground">
            Bloccato
          </span>
        </div>
        <p className="text-[13px] font-bold text-muted-foreground line-clamp-2 leading-snug">
          {node.title}
        </p>
      </motion.button>
    );
  }

  if (visual === 'completed') {
    return (
      <motion.button
        onClick={onTap}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 600, damping: 26 }}
        className={cn(shell, 'border')}
        style={{
          backgroundColor: 'var(--success-soft)',
          borderColor: withAlpha('var(--success)', 24),
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--success)', color: 'var(--success-foreground)' }}
          >
            <Check size={13} strokeWidth={3} />
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: 'var(--success)' }}
          >
            Completato
          </span>
        </div>
        <p className="text-[13px] font-bold text-foreground line-clamp-2 leading-snug">
          {node.title}
        </p>
      </motion.button>
    );
  }

  if (visual === 'in_progress') {
    return (
      <motion.button
        onClick={onTap}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 600, damping: 26 }}
        className={cn(shell, 'border border-border bg-card shadow-[var(--shadow-xs)]')}
        style={{ borderLeftWidth: 3, borderLeftColor: cat.color }}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <Badge color={cat.color} bg={cat.bg}>
            <CategoryIcon name={cat.icon} size={11} /> {cat.label}
          </Badge>
          <span className="text-[11px] font-bold tnum" style={{ color: cat.color }}>
            {node.progress ?? 0}%
          </span>
        </div>
        <p className="text-[13px] font-bold line-clamp-2 leading-snug mb-2">{node.title}</p>
        <ProgressBar value={node.progress ?? 0} color={cat.color} height={5} still />
      </motion.button>
    );
  }

  // available — l'unica card con l'alone: e' quella su cui si puo' agire ora.
  return (
    <motion.button
      onClick={onTap}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 600, damping: 26 }}
      className={cn(shell, 'node-halo bg-card shadow-[var(--shadow-sm)]')}
      style={{ border: '2px solid var(--primary)' }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <Badge color={cat.color} bg={cat.bg}>
          <CategoryIcon name={cat.icon} size={11} /> {cat.label}
        </Badge>
      </div>
      <p className="text-[13px] font-bold line-clamp-2 leading-snug mb-2">{node.title}</p>
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary">
        <span className="w-5 h-5 rounded-full bg-primary text-[var(--primary-foreground)] flex items-center justify-center">
          <Play size={9} fill="currentColor" strokeWidth={0} />
        </span>
        Inizia
      </span>
    </motion.button>
  );
}

// ─── Foglio di dettaglio della tappa ─────────────────────────────────────────

function NodeSheet({
  node,
  open,
  visual,
  blockedBy,
  isPreview,
  onStart,
  onProgress,
  onComplete,
  onClose,
}: {
  node: PathTreeNode | null;
  open: boolean;
  visual: VisualState;
  blockedBy: string[];
  isPreview?: boolean;
  onStart?: (goalId: string) => void;
  onProgress?: (goalId: string, value: number) => void;
  onComplete?: (goalId: string) => void;
  onClose: () => void;
}) {
  // Il cursore tiene una copia locale, riallineata quando cambia TAPPA. La
  // dipendenza e' solo l'id: se dipendesse anche dal progresso, ogni
  // aggiornamento ottimistico del genitore lo rimetterebbe a posto mentre il
  // dito lo sta ancora trascinando.
  const nodeId = node?.id;
  const nodeProgress = node?.progress ?? 0;
  const [localProgress, setLocalProgress] = useState(nodeProgress);
  useEffect(() => {
    setLocalProgress(nodeProgress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  if (!node) return null;

  const cat = CATEGORY_CONFIG[node.category];
  const canAct = !isPreview && !!node.goalId;

  return (
    <Dialog open={open} onClose={onClose} size="sm">
      <div className="pt-1">
        <Badge color={cat.color} bg={cat.bg}>
          <CategoryIcon name={cat.icon} size={12} /> {cat.label}
        </Badge>

        <h3 className="text-[18px] font-bold tracking-[-0.025em] mt-2.5 leading-snug">
          {node.title}
        </h3>
        {node.description && (
          <p className="text-[13.5px] text-muted-foreground leading-relaxed mt-1.5">
            {node.description}
          </p>
        )}

        {visual === 'locked' && (
          <div className="bg-muted rounded-[var(--radius-lg)] p-3.5 mt-4">
            <p className="text-[12px] font-bold text-foreground mb-1.5 flex items-center gap-1.5">
              <Lock size={13} strokeWidth={2.2} /> Per sbloccare, completa prima:
            </p>
            <ul className="text-[13px] text-muted-foreground list-disc pl-5 space-y-0.5">
              {blockedBy.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {visual === 'in_progress' && (
          <div className="mt-4 p-3.5 rounded-[var(--radius-lg)] bg-muted">
            {canAct ? (
              <Slider
                label="A che punto sei"
                value={localProgress}
                color={cat.color}
                onChange={(v) => {
                  setLocalProgress(v);
                  onProgress?.(node.goalId!, v);
                }}
              />
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-semibold text-muted-foreground">Progresso</span>
                  <span className="text-[13px] font-bold tnum" style={{ color: cat.color }}>
                    {localProgress}%
                  </span>
                </div>
                <ProgressBar value={localProgress} color={cat.color} height={6} />
              </>
            )}
          </div>
        )}

        {visual === 'completed' && (
          <div
            className="flex items-center gap-2 text-[13px] font-bold mt-4"
            style={{ color: 'var(--success)' }}
          >
            <Trophy size={14} strokeWidth={2.2} /> Tappa completata
          </div>
        )}

        {visual === 'available' && (
          <Button
            block
            size="lg"
            className="mt-5"
            disabled={!canAct}
            onClick={() => {
              if (node.goalId) {
                onStart?.(node.goalId);
                onClose();
              }
            }}
            icon={<Play size={14} fill="currentColor" strokeWidth={0} />}
          >
            Inizia questa tappa
          </Button>
        )}

        {visual === 'in_progress' && (
          <Button
            block
            size="lg"
            variant="success"
            className="mt-3"
            disabled={!canAct}
            onClick={() => {
              if (node.goalId) {
                onComplete?.(node.goalId);
                onClose();
              }
            }}
            icon={<Check size={15} strokeWidth={3} />}
          >
            Segna come completata
          </Button>
        )}

        {isPreview && (visual === 'available' || visual === 'in_progress') && (
          <p className="text-[11px] text-subtle-foreground text-center mt-2">
            Anteprima: le azioni sono disattivate.
          </p>
        )}
      </div>
    </Dialog>
  );
}
