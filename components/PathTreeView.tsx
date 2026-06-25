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
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { GoalCategory, GoalStatus, PlayerLevel } from '@/lib/database.types';
import { CATEGORY_CONFIG } from '@/lib/constants';
import { computePathState, type NodeId } from '@/lib/paths/topo';
import { Badge, ProgressBar } from './UI';
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

  return (
    <div className="flex flex-col">
      {/* Header: titolo + avanzamento, nei colori del club */}
      <div
        className="shrink-0 rounded-2xl overflow-hidden mb-4 text-white shadow-sm"
        style={{
          background:
            'linear-gradient(135deg, var(--club-blue-dark) 0%, var(--club-blue) 100%)',
        }}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                className="text-[17px] font-bold tracking-[-0.015em] truncate"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {data.title}
              </h3>
              <p className="text-[11px] text-white/60 mt-0.5">
                {completed} di {total} tappe completate
              </p>
            </div>
            <span
              className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold text-white"
              style={{ backgroundColor: 'var(--club-red)' }}
            >
              {data.difficulty}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div
              className="progress-track flex-1"
              style={{ height: 8, background: 'rgba(255,255,255,0.14)' }}
            >
              <div
                className="progress-fill h-full"
                style={{ width: `${pct}%`, backgroundColor: 'var(--club-red)' }}
              />
            </div>
            <span className="text-[12px] font-bold text-white/80 tabular-nums w-9 text-right">
              {pct}%
            </span>
          </div>
          {onDeactivate && !isPreview && (
            <button
              onClick={onDeactivate}
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/70 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Disattiva percorso per questo allievo
            </button>
          )}
        </div>
        <div className="club-stripe" />
      </div>

      {isPreview && (
        <div className="shrink-0 mb-3 flex items-center gap-2 text-[12px] text-[var(--club-blue)] bg-[var(--club-blue-light)] border border-[var(--club-blue)]/10 rounded-xl px-3 py-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Anteprima struttura del percorso (sola lettura).
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
                          : 'var(--club-blue)'
                        : '#C7CDD9'
                    }
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray={toUnlocked ? undefined : '4 5'}
                    strokeOpacity={toUnlocked ? 0.5 : 0.9}
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
                      className={`w-[180px] max-w-[46%] min-w-[150px] ${
                        justUnlocked.has(n.id) ? 'animate-unlock' : ''
                      }`}
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

      {/* Bottom sheet di dettaglio nodo */}
      {selected && (
        <NodeSheet
          node={selected}
          visual={visualOf(selected)}
          blockedBy={state.blockedBy[selected.id]?.map((id) => byId.get(id)?.title ?? id) ?? []}
          isPreview={isPreview}
          onStart={onStart}
          onProgress={onProgress}
          onComplete={onComplete}
          onClose={() => setSelectedId(null)}
        />
      )}
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

  if (visual === 'locked') {
    return (
      <button
        onClick={onTap}
        className="w-full h-full text-left rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/80 p-3 active:scale-[0.97] transition-transform"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="w-7 h-7 rounded-full bg-gray-200/80 text-gray-400 flex items-center justify-center shrink-0">
            <LockIcon />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Bloccato
          </span>
        </div>
        <p className="text-[13px] font-bold text-gray-500 line-clamp-2 leading-snug">{node.title}</p>
      </button>
    );
  }

  if (visual === 'completed') {
    return (
      <button
        onClick={onTap}
        className="w-full h-full text-left rounded-2xl border border-green-200 bg-green-50 p-3 active:scale-[0.97] transition-transform"
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-7 h-7 rounded-full text-white flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--success)' }}
          >
            <CheckIcon />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--success)' }}>
            Completato
          </span>
        </div>
        <p className="text-[13px] font-bold text-gray-700 line-clamp-2 leading-snug">{node.title}</p>
      </button>
    );
  }

  if (visual === 'in_progress') {
    return (
      <button
        onClick={onTap}
        className="w-full h-full text-left rounded-2xl border border-gray-100 bg-white shadow-sm p-3 active:scale-[0.97] transition-transform"
        style={{ borderLeftWidth: 4, borderLeftColor: cat.color }}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <Badge color={cat.color} bg={cat.bg}>
            <CategoryIcon name={cat.icon} size={11} /> {cat.label}
          </Badge>
          <span className="text-[11px] font-bold tabular-nums" style={{ color: cat.color }}>
            {node.progress ?? 0}%
          </span>
        </div>
        <p className="text-[13px] font-bold text-gray-900 line-clamp-2 leading-snug mb-2">{node.title}</p>
        <ProgressBar value={node.progress ?? 0} color={cat.color} height={5} />
      </button>
    );
  }

  // available
  return (
    <button
      onClick={onTap}
      className="node-halo w-full h-full text-left rounded-2xl bg-white shadow-sm p-3 active:scale-[0.97] transition-transform"
      style={{ border: '2px solid var(--club-red)' }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <Badge color={cat.color} bg={cat.bg}>
          <CategoryIcon name={cat.icon} size={11} /> {cat.label}
        </Badge>
      </div>
      <p className="text-[13px] font-bold text-gray-900 line-clamp-2 leading-snug mb-2">{node.title}</p>
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-bold"
        style={{ color: 'var(--club-red)' }}
      >
        <span
          className="w-5 h-5 rounded-full text-white flex items-center justify-center"
          style={{ backgroundColor: 'var(--club-red)' }}
        >
          <PlayIcon />
        </span>
        Inizia
      </span>
    </button>
  );
}

// ─── Bottom sheet ────────────────────────────────────────────────────────────

function NodeSheet({
  node,
  visual,
  blockedBy,
  isPreview,
  onStart,
  onProgress,
  onComplete,
  onClose,
}: {
  node: PathTreeNode;
  visual: VisualState;
  blockedBy: string[];
  isPreview?: boolean;
  onStart?: (goalId: string) => void;
  onProgress?: (goalId: string, value: number) => void;
  onComplete?: (goalId: string) => void;
  onClose: () => void;
}) {
  const cat = CATEGORY_CONFIG[node.category];
  const [localProgress, setLocalProgress] = useState(node.progress ?? 0);
  const canAct = !isPreview && !!node.goalId;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-[520px] bg-white rounded-t-3xl p-5 pb-8 animate-slide-up"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-10 h-1 rounded-full bg-gray-200 mb-4" />

        <div className="flex items-center gap-2 mb-2">
          <Badge color={cat.color} bg={cat.bg}>
            <CategoryIcon name={cat.icon} size={12} /> {cat.label}
          </Badge>
        </div>
        <h3
          className="text-lg font-bold text-gray-900 tracking-[-0.015em] mb-1"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {node.title}
        </h3>
        {node.description && (
          <p className="text-sm text-gray-500 leading-relaxed mb-4">{node.description}</p>
        )}

        {visual === 'locked' && (
          <div className="bg-gray-50 rounded-xl p-3 mb-4">
            <p className="text-[12px] font-bold text-gray-600 mb-1.5 flex items-center gap-1.5">
              <LockIcon /> Per sbloccare, completa prima:
            </p>
            <ul className="text-[13px] text-gray-700 list-disc pl-5 space-y-0.5">
              {blockedBy.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {visual === 'in_progress' && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] font-medium text-gray-500">Progresso</span>
              <span className="text-[12px] font-bold tabular-nums" style={{ color: cat.color }}>{localProgress}%</span>
            </div>
            {canAct ? (
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={localProgress}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setLocalProgress(v);
                  onProgress?.(node.goalId!, v);
                }}
                className="w-full accent-[var(--club-blue)]"
              />
            ) : (
              <ProgressBar value={localProgress} color={cat.color} height={6} />
            )}
          </div>
        )}

        {visual === 'completed' && (
          <div className="flex items-center gap-2 text-[13px] font-semibold mb-4" style={{ color: 'var(--success)' }}>
            <TrophyIcon /> Obiettivo completato
          </div>
        )}

        {/* Azioni */}
        {visual === 'available' && (
          <button
            disabled={!canAct}
            onClick={() => { if (node.goalId) { onStart?.(node.goalId); onClose(); } }}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
            style={{ backgroundColor: 'var(--club-red)' }}
          >
            Inizia obiettivo
          </button>
        )}

        {visual === 'in_progress' && (
          <button
            disabled={!canAct}
            onClick={() => { if (node.goalId) { onComplete?.(node.goalId); onClose(); } }}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
            style={{ backgroundColor: 'var(--success)' }}
          >
            Segna come completato
          </button>
        )}

        {isPreview && (visual === 'available' || visual === 'in_progress') && (
          <p className="text-[11px] text-gray-400 text-center mt-2">Anteprima: azioni disabilitate</p>
        )}
      </div>
    </div>
  );
}

// ─── Icone inline (nessuna dipendenza esterna) ───────────────────────────────

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}
