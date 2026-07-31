'use client';

/**
 * PathAdventureView — "Il mio percorso" in stile videogame (Duolingo-like).
 *
 * Sostituisce la vista ad albero (PathTreeView) lato allievo mantenendo lo
 * STESSO contratto di props e lo stesso view-model (PathTreeData): nessuna
 * modifica al data layer, e' solo una nuova "pelle" sugli stessi dati.
 *
 * COME FUNZIONA
 *  - Le tappe vengono ordinate topologicamente (Kahn, lib/paths/topo.ts) e
 *    disposte su un SENTIERO SERPENTINO verticale: centro → destra → centro
 *    → sinistra → ... come i percorsi di Duolingo.
 *  - Lo SCENARIO alle spalle e' un UNICO fondale a gradiente continuo (non
 *    piu' una serie di bande accostate): il colore viene campionato dalla
 *    rampa del mondo (`world.gradient`) lungo tutta l'altezza della mappa,
 *    quindi scendendo si scivola senza stacchi dalla luce della superficie
 *    al buio piu' fitto dell'habitat. Le decorazioni (onde, alberi,
 *    ninfee...) restano organizzate per fasce logiche e aumentano di
 *    densita' con la profondita': piu' si avanza, piu' l'ambiente sembra
 *    difficile da affrontare.
 *  - Il MONDO dipende dalla difficolta' del percorso (DELFINO = mare,
 *    CERBIATTO = bosco, COCCODRILLO = palude). Vedi lib/paths/worlds.ts.
 *  - L'AVATAR (mascotte) sta accanto alla tappa corrente ed evolve secondo
 *    il principio dei tre livelli: Cucciolo → Ragazzo → Adulto in base alla
 *    percentuale di tappe completate. Le grafiche stanno in
 *    public/percorsi/<mondo>/<tier>.png e sono collegate in worlds.ts; se un
 *    `tier.image` e' vuoto si ricade sul placeholder (emoji + piastra).
 *  - Lo SBLOCCO resta quello del DAG: una tappa e' disponibile solo se tutti
 *    i prerequisiti sono completati (il sentiero e' una visualizzazione, la
 *    logica e' sempre computePathState).
 *  - A percorso COMPLETATO compare il traguardo dorato e l'invito a passare
 *    al livello successivo (Delfino → Cerbiatto → Coccodrillo).
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { CATEGORY_CONFIG } from '@/lib/constants';
import { computePathState, type NodeId } from '@/lib/paths/topo';
import {
  WORLDS,
  nextLevel,
  tierForCompletion,
  lerpColor,
  rampColor,
  easeDepth,
  seeded,
  type WorldConfig,
} from '@/lib/paths/worlds';
import { Badge, ProgressBar } from './UI';
import { CategoryIcon } from './CategoryIcon';
import type { PathTreeData, PathTreeNode } from './PathTreeView';

// Ri-esportati per comodita' dei consumer (PlayerView, PathEditor).
export type { PathTreeData, PathTreeNode } from './PathTreeView';

// ─── Geometria del sentiero ─────────────────────────────────────────────────

/** Larghezza del viewBox dello scenario (coordinate orizzontali logiche). */
const VB_W = 390;
/** Altezza (px reali) della banda di scenario dedicata a ogni tappa. */
const BAND = 150;
/** Altezza della banda finale con il traguardo. */
const FINISH_BAND = 150;
/** Serpentina: frazioni orizzontali ripetute (centro, destra, centro, sinistra). */
const X_PATTERN = [0.5, 0.76, 0.5, 0.24];

const xForIndex = (i: number) => X_PATTERN[i % X_PATTERN.length] * VB_W;
const yForIndex = (i: number) => i * BAND + BAND / 2;

type VisualState = 'locked' | 'available' | 'in_progress' | 'completed';

interface PathAdventureViewProps {
  data: PathTreeData;
  /** Anteprima/sola-lettura (editor del maestro): azioni disabilitate. */
  isPreview?: boolean;
  onStart?: (goalId: string) => void;
  onProgress?: (goalId: string, value: number) => void;
  onComplete?: (goalId: string) => void;
  /** Solo maestro: disattiva il percorso per questo allievo. */
  onDeactivate?: () => void;
}

// ─── Componente principale ───────────────────────────────────────────────────

export function PathAdventureView({
  data,
  isPreview,
  onStart,
  onProgress,
  onComplete,
  onDeactivate,
}: PathAdventureViewProps) {
  const world = WORLDS[data.difficulty];
  const [selectedId, setSelectedId] = useState<NodeId | null>(null);

  // 1) Algoritmo (Kahn): validazione, layering, frontiera sbloccata.
  const completion = useMemo(
    () => new Set(data.nodes.filter((n) => n.status === 'completed').map((n) => n.id)),
    [data.nodes]
  );
  const state = useMemo(
    () => computePathState(data.nodes.map((n) => ({ id: n.id })), data.edges, completion),
    [data.nodes, data.edges, completion]
  );

  // 2) Ordine del sentiero: topologico (layer crescente), stabile rispetto
  //    all'ordine originale (sort_order del maestro) a parita' di layer.
  const ordered = useMemo(() => {
    const idx = new Map(data.nodes.map((n, i) => [n.id, i]));
    return [...data.nodes].sort((a, b) => {
      const la = state.layer[a.id] ?? 0;
      const lb = state.layer[b.id] ?? 0;
      if (la !== lb) return la - lb;
      return (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0);
    });
  }, [data.nodes, state.layer]);

  const byId = useMemo(() => {
    const m = new Map<NodeId, PathTreeNode>();
    for (const n of data.nodes) m.set(n.id, n);
    return m;
  }, [data.nodes]);

  const visualOf = (n: PathTreeNode): VisualState => {
    if (n.status === 'completed') return 'completed';
    if (n.status === 'in_progress') return 'in_progress';
    return state.unlocked[n.id] ? 'available' : 'locked';
  };

  const total = data.nodes.length;
  const completedCount = completion.size;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const isFinished = total > 0 && completedCount === total;
  const tier = tierForCompletion(completedCount, total);

  // Tappa "corrente" (dove sta la mascotte): la prima del sentiero che e'
  // sbloccata ma non completata. Se il percorso e' finito, sta al traguardo.
  const currentIndex = useMemo(() => {
    const i = ordered.findIndex((n) => n.status !== 'completed' && state.unlocked[n.id]);
    return i;
  }, [ordered, state.unlocked]);

  // 3) Animazione di sblocco: marca le tappe appena passate da bloccato a
  //    sbloccato (stesso meccanismo di PathTreeView).
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

  const totalH = ordered.length * BAND + FINISH_BAND;
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const selectedIndex = selected ? ordered.findIndex((n) => n.id === selected.id) : -1;

  return (
    <div className="flex flex-col">
      <WorldHeader
        world={world}
        title={data.title}
        tier={tier}
        completed={completedCount}
        total={total}
        pct={pct}
        isFinished={isFinished}
        isPreview={isPreview}
        onDeactivate={onDeactivate}
      />

      {isPreview && (
        <div className="shrink-0 mb-3 flex items-center gap-2 text-[12px] text-[var(--club-blue)] bg-[var(--club-blue-light)] border border-[var(--club-blue)]/10 rounded-xl px-3 py-2">
          <InfoIcon />
          Anteprima del percorso (sola lettura): cosi&#39; lo vedra&#39; l&#39;allievo.
        </div>
      )}

      {/* ─── La mappa dell'avventura ─── */}
      <div className="pb-6">
        <div
          className="relative mx-auto w-full max-w-[480px] rounded-3xl overflow-hidden shadow-md"
          style={{ height: totalH }}
        >
          <SceneBackground
            world={world}
            ordered={ordered}
            completion={completion}
            currentIndex={currentIndex}
            isFinished={isFinished}
            totalH={totalH}
          />

          {/* Tappe (pulsanti circolari) */}
          {ordered.map((n, i) => {
            const visual = visualOf(n);
            const x = xForIndex(i);
            const y = yForIndex(i);
            const isCurrent = i === currentIndex;
            return (
              <div
                key={n.id}
                className={`absolute z-10 ${justUnlocked.has(n.id) ? 'animate-unlock' : ''}`}
                style={{
                  left: `${(x / VB_W) * 100}%`,
                  top: y,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <NodeButton
                  node={n}
                  index={i}
                  visual={visual}
                  world={world}
                  isCurrent={isCurrent}
                  onTap={() => setSelectedId(n.id)}
                />
              </div>
            );
          })}

          {/* Mascotte accanto alla tappa corrente (o al traguardo se finito) */}
          <MascotOnPath
            world={world}
            tier={tier}
            ordered={ordered}
            currentIndex={currentIndex}
            isFinished={isFinished}
          />

          {/* Traguardo */}
          <FinishFlag world={world} ordered={ordered} isFinished={isFinished} />
        </div>
      </div>

      {/* Bottom sheet di dettaglio tappa */}
      {selected && (
        <NodeSheet
          key={selected.id}
          node={selected}
          stepNumber={selectedIndex + 1}
          visual={visualOf(selected)}
          world={world}
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

// ─── Header del mondo ────────────────────────────────────────────────────────

function WorldHeader({
  world,
  title,
  tier,
  completed,
  total,
  pct,
  isFinished,
  isPreview,
  onDeactivate,
}: {
  world: WorldConfig;
  title: string;
  tier: 0 | 1 | 2;
  completed: number;
  total: number;
  pct: number;
  isFinished: boolean;
  isPreview?: boolean;
  onDeactivate?: () => void;
}) {
  const next = nextLevel(world.level);
  return (
    <div
      className="shrink-0 rounded-2xl overflow-hidden mb-4 text-white shadow-sm"
      style={{
        background: `linear-gradient(135deg, var(--club-blue-dark) 0%, ${lerpColor(
          world.skyEnd,
          '#122840',
          0.35
        )} 55%, ${world.accentDark} 130%)`,
      }}
    >
      <div className="p-4">
        <div className="flex items-center gap-3.5">
          <MascotBadge world={world} tier={tier} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold text-white"
                style={{ backgroundColor: 'var(--club-red)' }}
              >
                {world.level}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                Avatar: {world.tiers[tier].label}
              </span>
            </div>
            <h3
              className="text-[17px] font-bold tracking-[-0.015em] truncate mt-1"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {title}
            </h3>
            <p className="text-[11px] text-white/60 mt-0.5">
              {world.tagline} · {completed} di {total} tappe
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3.5">
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

        {/* Percorso completato: festeggia e indica il livello successivo */}
        {isFinished && !isPreview && (
          <div className="mt-3.5 rounded-xl px-3.5 py-3 bg-white/10 border border-white/15">
            <p className="text-[13px] font-bold flex items-center gap-1.5">
              <span aria-hidden>🏆</span> Percorso completato!
            </p>
            <p className="text-[12px] text-white/75 mt-0.5 leading-relaxed">
              {next
                ? `Sei pronto per il mondo ${WORLDS[next].name}: chiedi al maestro di attivare il prossimo percorso.`
                : 'Hai raggiunto la vetta: il mondo Coccodrillo non ha piu\u0027 segreti per te!'}
            </p>
          </div>
        )}

        {onDeactivate && !isPreview && (
          <button
            onClick={onDeactivate}
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/70 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors"
          >
            <CloseIcon />
            Disattiva percorso per questo allievo
          </button>
        )}
      </div>
      <div className="club-stripe" />
    </div>
  );
}

// ─── Avatar / mascotte ───────────────────────────────────────────────────────

/**
 * Badge circolare della mascotte. Se il tier ha un'immagine (`tier.image`)
 * la usa (ritagliata in cerchio, con bordo bianco e alone colorato);
 * altrimenti mostra il placeholder (piastra + emoji + alone).
 */
export function MascotBadge({
  world,
  tier,
  size = 56,
  showLabel = false,
  bob = false,
}: {
  world: WorldConfig;
  tier: 0 | 1 | 2;
  size?: number;
  showLabel?: boolean;
  bob?: boolean;
}) {
  const t = world.tiers[tier];
  return (
    <div
      className="relative shrink-0 flex items-center justify-center"
      style={{ width: size, height: size + (showLabel ? 12 : 0) }}
    >
      {/* alone */}
      <div
        className="absolute rounded-full"
        style={{
          inset: -size * 0.12,
          bottom: showLabel ? 12 - size * 0.12 : -size * 0.12,
          background: `radial-gradient(circle, ${t.aura}b3, transparent 68%)`,
          filter: 'blur(2px)',
        }}
        aria-hidden
      />
      {/* piastra */}
      <div
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          top: 0,
          background: t.plate,
          boxShadow: `0 6px 18px ${t.shadow}, inset 0 -4px 0 rgba(0,0,0,0.15)`,
        }}
        aria-hidden
      />
      {/* avatar: immagine vera se presente, altrimenti emoji placeholder */}
      <div
        className={`absolute z-[2] flex items-center justify-center ${bob ? 'adv-bob' : ''}`}
        style={{ width: size, height: size, top: 0 }}
      >
        {t.image ? (
          // Le grafiche sono quadrate e opache: le ritagliamo in cerchio e le
          // bordiamo di bianco cosi' restano leggibili sia sull'header scuro
          // sia sopra lo scenario colorato della mappa.
          <span
            className="block rounded-full overflow-hidden"
            style={{
              width: size,
              height: size,
              boxShadow: `0 0 0 2px rgba(255,255,255,0.85), 0 6px 18px ${t.shadow}`,
            }}
          >
            <Image
              src={t.image}
              alt={`${world.name} ${t.label}`}
              width={size}
              height={size}
              sizes={`${size}px`}
              className="w-full h-full object-cover"
            />
          </span>
        ) : (
          <span
            style={{
              fontSize: size * 0.56,
              lineHeight: 1,
              filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.3))',
            }}
            aria-label={`${world.name} ${t.label}`}
          >
            {world.mascotEmoji}
          </span>
        )}
      </div>
      {showLabel && (
        <span
          className="absolute z-[3] bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full bg-white text-[9px] font-extrabold uppercase tracking-[0.06em] text-gray-800"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
        >
          {t.label}
        </span>
      )}
    </div>
  );
}

/** Mascotte posizionata sul sentiero, accanto alla tappa corrente. */
function MascotOnPath({
  world,
  tier,
  ordered,
  currentIndex,
  isFinished,
}: {
  world: WorldConfig;
  tier: 0 | 1 | 2;
  ordered: PathTreeNode[];
  currentIndex: number;
  isFinished: boolean;
}) {
  if (ordered.length === 0) return null;

  // A percorso finito la mascotte festeggia al traguardo; se nessuna tappa
  // e' sbloccata (caso limite) sta all'inizio.
  let x: number;
  let y: number;
  if (isFinished) {
    x = VB_W / 2 + 62;
    y = ordered.length * BAND + FINISH_BAND / 2;
  } else {
    const i = currentIndex >= 0 ? currentIndex : 0;
    const nx = xForIndex(i);
    x = nx <= VB_W / 2 ? nx + 66 : nx - 66;
    y = yForIndex(i) - 6;
  }

  return (
    <div
      className="absolute z-20 pointer-events-none"
      style={{
        left: `${(x / VB_W) * 100}%`,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <MascotBadge world={world} tier={tier} size={52} showLabel bob />
    </div>
  );
}

// ─── Scenario (fondale continuo, dal calmo al selvaggio) ─────────────────────

function SceneBackground({
  world,
  ordered,
  completion,
  currentIndex,
  isFinished,
  totalH,
}: {
  world: WorldConfig;
  ordered: PathTreeNode[];
  completion: ReadonlySet<NodeId>;
  currentIndex: number;
  isFinished: boolean;
  totalH: number;
}) {
  const N = ordered.length;
  const bandCount = N + 1; // + fascia del traguardo

  // Profondita' t di una fascia in [0,1]: governa quanto lo scenario e'
  // "selvaggio" (decorazioni piu' fitte, piu' scure, piu' ostili).
  // ATTENZIONE: il COLORE del fondale NON usa piu' questo valore a scalini,
  // altrimenti ogni tappa sembra un ambiente a se'. Il fondale e' un unico
  // gradiente continuo (vedi `skyStops`).
  const depth = (i: number) => (bandCount <= 1 ? 0 : Math.min(1, i / (bandCount - 1)));

  // FONDALE CONTINUO: campioniamo la rampa del mondo in molti punti lungo
  // tutta l'altezza della mappa. Con ~24 campioni l'occhio non percepisce
  // piu' alcuno stacco: scendendo ci si addentra gradualmente nell'habitat.
  const SAMPLES = 24;
  const skyStops = Array.from({ length: SAMPLES + 1 }, (_, k) => {
    const p = k / SAMPLES;
    return { offset: (p * 100).toFixed(2), color: rampColor(world.gradient, easeDepth(p)) };
  });

  // Veli di foschia sparsi (deterministici): aggiungono atmosfera e senso di
  // profondita' SENZA creare bordi netti, perche' sfumano sopra e sotto.
  const mistCount = Math.max(1, Math.round(bandCount * 0.7));
  const mists = Array.from({ length: mistCount }, (_, k) => {
    const p = (k + 0.5) / mistCount;
    const mh = 70 + seeded(k, 91) * 110;
    return {
      key: k,
      y: p * totalH - mh / 2 + (seeded(k, 17) - 0.5) * 70,
      h: mh,
      opacity: 0.04 + p * 0.14,
    };
  });

  return (
    <svg
      className="absolute inset-0 w-full"
      style={{ height: totalH }}
      viewBox={`0 0 ${VB_W} ${totalH}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {/* Un solo gradiente per tutta la mappa: chiaro in cima, fitto in fondo */}
        <linearGradient id={`adv-sky-${world.id}`} x1="0" y1="0" x2="0" y2="1">
          {skyStops.map((s, k) => (
            <stop key={k} offset={`${s.offset}%`} stopColor={s.color} />
          ))}
        </linearGradient>
        {/* Foschia: bianco che sfuma a zero sopra e sotto (niente linee dure) */}
        <linearGradient id={`adv-mist-${world.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {/* Alone morbido attorno alla tappa corrente */}
        <linearGradient id={`adv-here-${world.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {/* Alone del sole, solo in superficie */}
        <radialGradient id={`adv-sun-${world.id}`}>
          <stop offset="0%" stopColor={world.sunStart} stopOpacity="0.5" />
          <stop offset="100%" stopColor={world.sunStart} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Fondale unico e continuo */}
      <rect x="0" y="0" width={VB_W} height={totalH} fill={`url(#adv-sky-${world.id})`} />

      {/* Sole: sta solo in cima, dove la luce e' ancora piena */}
      <circle cx={VB_W - 70} cy={34} r={70} fill={`url(#adv-sun-${world.id})`} />
      <circle cx={VB_W - 70} cy={34} r={26} fill={world.sunStart} opacity={0.92} />

      {/* Decorazioni del bioma: raggruppate per fascia, densita' crescente */}
      {Array.from({ length: bandCount }).map((_, i) => {
        const h = i === N ? FINISH_BAND : BAND;
        return (
          <g key={i} transform={`translate(0, ${i * BAND})`}>
            <BiomeDecor world={world} bandIndex={i} t={depth(i)} h={h} />
          </g>
        );
      })}

      {/* Veli di foschia DAVANTI alle decorazioni: piu' si scende, piu'
          l'ambiente si fa opaco e difficile da leggere. */}
      {mists.map((m) => (
        <rect
          key={`mist-${m.key}`}
          x="0"
          y={m.y}
          width={VB_W}
          height={m.h}
          fill={`url(#adv-mist-${world.id})`}
          opacity={m.opacity}
        />
      ))}

      {/* Sentiero tratteggiato tra le tappe (e fino al traguardo) */}
      {ordered.map((n, i) => {
        const x1 = xForIndex(i);
        const y1 = yForIndex(i);
        const isLast = i === ordered.length - 1;
        const x2 = isLast ? VB_W / 2 : xForIndex(i + 1);
        const y2 = isLast ? ordered.length * BAND + FINISH_BAND / 2 : yForIndex(i + 1);
        const my = (y1 + y2) / 2;
        // Il tratto e' "conquistato" se la tappa di partenza e' completata.
        const conquered = completion.has(n.id);
        // Contrasto adattivo: ora che il fondale e' un degrade' continuo, in
        // cima e' molto chiaro (serve un tratto scuro) e in fondo molto scuro
        // (serve un tratto chiaro). Prima bastava il bianco fisso.
        const td = totalH > 0 ? easeDepth(my / totalH) : 0;
        const trailColor = conquered
          ? world.accent
          : lerpColor('#1F2937', '#FFFFFF', Math.min(1, td * 1.7));
        return (
          <path
            key={`trail-${n.id}`}
            d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
            fill="none"
            stroke={trailColor}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray="1 14"
            opacity={conquered ? 0.95 : 0.62}
          />
        );
      })}

      {/* Bagliore attorno alla tappa corrente: sfumato, cosi' non ridisegna
          un rettangolo netto sul fondale continuo. */}
      {!isFinished && currentIndex >= 0 && (
        <rect
          x="0"
          y={currentIndex * BAND - BAND * 0.3}
          width={VB_W}
          height={BAND * 1.6}
          fill={`url(#adv-here-${world.id})`}
        />
      )}
    </svg>
  );
}

/**
 * Decorazioni del bioma per una banda: densita' e "ostilita'" crescono con t.
 * Elementi deterministici (seeded) cosi' non cambiano tra i render.
 */
function BiomeDecor({
  world,
  bandIndex,
  t,
  h,
}: {
  world: WorldConfig;
  bandIndex: number;
  t: number;
  h: number;
}) {
  const out: ReactNode[] = [];
  const s = (n: number) => seeded(bandIndex + 1, n);

  if (world.id === 'delfino') {
    // Onde: piu' numerose e marcate in profondita'.
    const waves = 2 + Math.round(t * 4);
    for (let i = 0; i < waves; i++) {
      // Distribuite su tutta la fascia (non ammassate sul fondo): cosi' non
      // si formano "righe d'orizzonte" che spezzerebbero il degrade'.
      const y = 16 + ((i + s(i)) / waves) * (h - 26);
      out.push(
        <path
          key={`w${i}`}
          d={`M-10 ${y} q 26 -${6 + t * 6} 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0 t 52 0`}
          stroke="#fff"
          strokeOpacity={0.2 + t * 0.25}
          strokeWidth={1 + t * 1.6}
          fill="none"
          strokeLinecap="round"
        />
      );
    }
    // Bolle
    const bubbles = 3 + Math.round(t * 7);
    for (let i = 0; i < bubbles; i++) {
      out.push(
        <circle
          key={`b${i}`}
          cx={s(i + 10) * VB_W}
          cy={14 + s(i + 20) * (h - 30)}
          r={1.5 + s(i + 30) * (2.5 + t * 3)}
          fill="#fff"
          opacity={0.25 + t * 0.2}
        />
      );
    }
    // Pinne di squalo nelle acque profonde (t alto): l'ambiente si fa ostile.
    if (t > 0.55) {
      const fins = Math.round((t - 0.4) * 4);
      for (let i = 0; i < fins; i++) {
        const cx = 30 + s(i + 40) * (VB_W - 60);
        const cy = 26 + s(i + 50) * (h - 48);
        out.push(
          <path
            key={`f${i}`}
            d={`M ${cx - 9} ${cy} Q ${cx} ${cy - 15} ${cx + 3} ${cy} Z`}
            fill={lerpColor('#334155', '#0F172A', t)}
            opacity={0.85}
          />
        );
      }
    }
  }

  if (world.id === 'cerbiatto') {
    // Abeti: piu' fitti e scuri in profondita'.
    const trees = 3 + Math.round(t * 6);
    for (let i = 0; i < trees; i++) {
      const x = s(i) * VB_W;
      const th = 26 + s(i + 10) * 22 + t * 16;
      const tw = 18 + s(i + 20) * 10;
      const baseY = h * (0.28 + s(i + 30) * 0.68);
      const shade = lerpColor('#14532D', '#020617', Math.min(1, t * 0.9 + s(i + 40) * 0.2));
      out.push(
        <polygon
          key={`t${i}`}
          points={`${x - tw / 2},${baseY} ${x},${baseY - th} ${x + tw / 2},${baseY}`}
          fill={shade}
          opacity={0.9}
        />
      );
    }
    // Lucciole nel bosco che si fa buio.
    if (t > 0.35) {
      const flies = Math.round(t * 7);
      for (let i = 0; i < flies; i++) {
        out.push(
          <circle
            key={`l${i}`}
            cx={s(i + 50) * VB_W}
            cy={12 + s(i + 60) * (h - 40)}
            r={1.4}
            fill="#FBBF24"
            opacity={0.5 + t * 0.4}
          />
        );
      }
    }
    // Occhi nel folto (t alto).
    if (t > 0.7) {
      const cx = 30 + s(70) * (VB_W - 60);
      const cy = 24 + s(80) * (h - 60);
      out.push(
        <g key="eyes" opacity={0.85}>
          <circle cx={cx - 4} cy={cy} r={1.6} fill="#FCD34D" />
          <circle cx={cx + 4} cy={cy} r={1.6} fill="#FCD34D" />
        </g>
      );
    }
  }

  if (world.id === 'coccodrillo') {
    // Ninfee: piu' grandi e scure in profondita'.
    const pads = 3 + Math.round(t * 5);
    for (let i = 0; i < pads; i++) {
      const cx = s(i) * VB_W;
      const cy = 20 + s(i + 10) * (h - 40);
      const r = 10 + s(i + 20) * (8 + t * 8);
      out.push(
        <ellipse
          key={`p${i}`}
          cx={cx}
          cy={cy}
          rx={r}
          ry={r * 0.42}
          fill={lerpColor('#65A30D', '#1A2E05', t)}
          opacity={0.85}
        />
      );
      // Occhi di coccodrillo che spuntano dall'acqua (t alto).
      if (t > 0.45 && i % 3 === 0) {
        out.push(
          <g key={`e${i}`} opacity={0.9}>
            <circle cx={cx - 4} cy={cy - 3} r={1.5} fill="#FCD34D" />
            <circle cx={cx + 4} cy={cy - 3} r={1.5} fill="#FCD34D" />
          </g>
        );
      }
    }
    // Canne di palude.
    const reeds = 2 + Math.round(t * 4);
    for (let i = 0; i < reeds; i++) {
      const x = s(i + 30) * VB_W;
      const rh = 18 + s(i + 40) * 20;
      const baseY = h * (0.35 + s(i + 60) * 0.6);
      out.push(
        <rect
          key={`r${i}`}
          x={x}
          y={baseY - rh}
          width={2.4}
          height={rh}
          rx={1.2}
          fill={lerpColor('#4D7C0F', '#1C1917', t)}
          opacity={0.8}
        />
      );
    }
    // Nebbia che avanza (t alto). Usa il gradiente condiviso `adv-mist` cosi'
    // sfuma sopra e sotto invece di disegnare una fascia netta.
    if (t > 0.5) {
      out.push(
        <rect
          key="mist"
          x="0"
          y={h * 0.35}
          width={VB_W}
          height={h * 0.55}
          fill={`url(#adv-mist-${world.id})`}
          opacity={(t - 0.5) * 0.3}
        />
      );
    }
  }

  return <>{out}</>;
}

// ─── Pulsante tappa ──────────────────────────────────────────────────────────

const NODE_SIZE = 64;
const NODE_SIZE_CURRENT = 74;

function NodeButton({
  node,
  index,
  visual,
  world,
  isCurrent,
  onTap,
}: {
  node: PathTreeNode;
  index: number;
  visual: VisualState;
  world: WorldConfig;
  isCurrent: boolean;
  onTap: () => void;
}) {
  const cat = CATEGORY_CONFIG[node.category];
  const size = isCurrent ? NODE_SIZE_CURRENT : NODE_SIZE;
  const progress = node.progress ?? 0;

  const face =
    visual === 'completed'
      ? world.accent
      : visual === 'locked'
        ? '#E5E7EB'
        : '#FFFFFF';
  const edge =
    visual === 'completed'
      ? world.accentDark
      : visual === 'locked'
        ? '#B6BDC9'
        : visual === 'in_progress'
          ? cat.color
          : 'var(--club-red)';

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* anello di avanzamento (solo tappe in corso) */}
        {visual === 'in_progress' && (
          <div
            className="absolute rounded-full"
            style={{
              inset: -5,
              background: `conic-gradient(${cat.color} ${progress * 3.6}deg, rgba(255,255,255,0.4) 0deg)`,
            }}
            aria-hidden
          />
        )}
        {/* anello pulsante sulla tappa corrente disponibile */}
        {isCurrent && visual === 'available' && (
          <span
            className="adv-pulse-ring absolute rounded-full border-[3px]"
            style={{ inset: -9, borderColor: '#F5B921' }}
            aria-hidden
          />
        )}
        <button
          onClick={onTap}
          className="adv-node relative rounded-full flex items-center justify-center"
          style={{
            width: size,
            height: size,
            background: face,
            boxShadow:
              visual === 'locked'
                ? 'inset 0 -4px 0 rgba(0,0,0,0.10), 0 4px 10px rgba(0,0,0,0.18)'
                : `0 5px 0 ${edge}, 0 10px 18px rgba(0,0,0,0.28)`,
          }}
          aria-label={`Tappa ${index + 1}: ${node.title}`}
        >
          {visual === 'completed' && <CheckIcon size={26} color="#fff" />}
          {visual === 'locked' && <LockIcon size={22} color="#9CA3AF" />}
          {visual === 'in_progress' && (
            <span style={{ color: cat.color }}>
              <CategoryIcon name={cat.icon} size={26} strokeWidth={2.2} />
            </span>
          )}
          {visual === 'available' && (
            <span
              className="flex items-center justify-center rounded-full"
              style={{
                width: size * 0.5,
                height: size * 0.5,
                backgroundColor: 'var(--club-red)',
                color: '#fff',
              }}
            >
              <PlayIcon size={Math.round(size * 0.22)} />
            </span>
          )}
        </button>
      </div>

      {/* Etichetta tappa (pillola leggibile su qualsiasi sfondo) */}
      <div
        className="mt-2 max-w-[150px] px-2.5 py-1 rounded-xl bg-white/95 text-center"
        style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.22)' }}
      >
        <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-gray-400 leading-tight">
          Tappa {index + 1}
        </p>
        <p
          className={`text-[11px] font-bold leading-tight line-clamp-2 ${
            visual === 'locked' ? 'text-gray-400' : 'text-gray-900'
          }`}
        >
          {node.title}
        </p>
      </div>
    </div>
  );
}

// ─── Traguardo ───────────────────────────────────────────────────────────────

function FinishFlag({
  world,
  ordered,
  isFinished,
}: {
  world: WorldConfig;
  ordered: PathTreeNode[];
  isFinished: boolean;
}) {
  const y = ordered.length * BAND + FINISH_BAND / 2;
  return (
    <div
      className="absolute z-10 flex flex-col items-center"
      style={{ left: '50%', top: y, transform: 'translate(-50%, -50%)' }}
    >
      <div
        className={`rounded-full flex items-center justify-center ${isFinished ? 'adv-bob' : ''}`}
        style={{
          width: 66,
          height: 66,
          background: isFinished
            ? 'radial-gradient(circle, #FDE68A, #F5B921)'
            : 'rgba(255,255,255,0.22)',
          border: isFinished ? 'none' : '2px dashed rgba(255,255,255,0.6)',
          boxShadow: isFinished
            ? `0 5px 0 #C8920F, 0 12px 26px rgba(245,185,33,0.5)`
            : 'none',
        }}
      >
        <span style={{ fontSize: 30, lineHeight: 1 }} aria-hidden>
          {isFinished ? '🏆' : '🏁'}
        </span>
      </div>
      <div
        className="mt-2 px-2.5 py-1 rounded-xl bg-white/95 text-center"
        style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.22)' }}
      >
        <p className="text-[11px] font-bold leading-tight" style={{ color: isFinished ? world.accentDark : '#6B7280' }}>
          {isFinished ? 'Percorso completato!' : 'Traguardo'}
        </p>
      </div>
    </div>
  );
}

// ─── Bottom sheet di dettaglio tappa ────────────────────────────────────────

function NodeSheet({
  node,
  stepNumber,
  visual,
  world,
  blockedBy,
  isPreview,
  onStart,
  onProgress,
  onComplete,
  onClose,
}: {
  node: PathTreeNode;
  stepNumber: number;
  visual: VisualState;
  world: WorldConfig;
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

        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold text-white"
            style={{ backgroundColor: world.accent }}
          >
            Tappa {stepNumber}
          </span>
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
              <LockIcon size={13} color="#4B5563" /> Per sbloccare, completa prima:
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
              <span className="text-[12px] font-bold tabular-nums" style={{ color: cat.color }}>
                {localProgress}%
              </span>
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
          <div
            className="flex items-center gap-2 text-[13px] font-semibold mb-4"
            style={{ color: 'var(--success)' }}
          >
            <TrophyIcon /> Tappa completata
          </div>
        )}

        {visual === 'available' && (
          <button
            disabled={!canAct}
            onClick={() => {
              if (node.goalId) {
                onStart?.(node.goalId);
                onClose();
              }
            }}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
            style={{ backgroundColor: 'var(--club-red)' }}
          >
            Inizia la tappa
          </button>
        )}

        {visual === 'in_progress' && (
          <button
            disabled={!canAct}
            onClick={() => {
              if (node.goalId) {
                onComplete?.(node.goalId);
                onClose();
              }
            }}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
            style={{ backgroundColor: 'var(--success)' }}
          >
            Segna come completata
          </button>
        )}

        {isPreview && (visual === 'available' || visual === 'in_progress') && (
          <p className="text-[11px] text-gray-400 text-center mt-2">
            Anteprima: azioni disabilitate
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Icone inline (nessuna dipendenza esterna) ───────────────────────────────

function LockIcon({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function CheckIcon({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PlayIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 4 20 12 6 20 6 4" />
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

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
