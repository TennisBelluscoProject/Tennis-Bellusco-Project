'use client';

/**
 * KidsPathMap — i 12 passi come sentiero d'avventura.
 *
 * COME E' FATTO
 *  - DODICI nodi su un SENTIERO SERPENTINO verticale, uno per passo, uniti da
 *    UNA SOLA CURVA CONTINUA (Catmull-Rom convertita in Bezier): non piu'
 *    tratti indipendenti, cosi' il sentiero si legge come un unico cammino.
 *    Sui tratti gia' percorsi restano le IMPRONTE della mascotte (pinna per
 *    il Delfino, zoccoli per il Cerbiatto, zampa per il Coccodrillo).
 *  - Lo SCENARIO e' il bioma del livello (Delfino = mare, Cerbiatto = bosco,
 *    Coccodrillo = palude): un unico gradiente continuo che si fa piu' fitto
 *    e scuro scendendo, cosi' si ha la sensazione di addentrarsi nell'habitat.
 *    La vegetazione sta SOLO SUI BORDI (silhouette morbide) e il centro resta
 *    pulito: e' li' che passano sentiero, nodi ed etichette.
 *  - L'avanzamento e' raccontato in PUNTI ESPERIENZA e LIVELLI (vedi xp.ts),
 *    non in "passi completati": ogni obiettivo vale piu' XP man mano che si
 *    avanza, e ogni livello costa piu' del precedente.
 *  - Ogni 2 PASSI c'e' un CANCELLO, ma si vede SOLO FINCHE' E' CHIUSO: una
 *    linea sottile che taglia la mappa con al centro una pastiglia che dice
 *    quale livello serve per proseguire e quanto manca. Appena si apre
 *    sparisce, riga compresa: a quel punto non aggiunge nulla, perche' il
 *    sentiero colorato e le impronte raccontano gia' che di li' si e' passati.
 *  - L'AVATAR sta in due posti: nella TESTATA, come "faccia" del percorso
 *    accanto al livello e alla barra dell'esperienza, e SUL SENTIERO, accanto
 *    al passo corrente. Quando il passo corrente cambia non salta: PERCORRE
 *    la curva fino alla nuova posizione, cosi' si vede la strada fatta. Si
 *    evolve a livelli prestabiliti (`state.tierLevels`).
 *
 * DUE FORMATI
 *  Su telefono la mappa esce dai margini e occupa tutta la larghezza dello
 *  schermo, senza riepilogo sotto: con dodici fasce da 150px il riepilogo
 *  finirebbe dopo quasi duemila pixel di scorrimento, dove non arriva
 *  nessuno. Da 900px in su la mappa si allarga e viene affiancata da una
 *  COLONNA DESTRA appiccicata che mostra il riepilogo — oppure la scheda del
 *  passo aperto, passata dal chiamante con la prop `detail`. La geometria e'
 *  raccolta in `GEO_MOBILE` / `GEO_DESKTOP`: niente numeri magici sparsi nel
 *  componente.
 *
 * Componente PRESENTAZIONALE: riceve lo stato gia' calcolato
 * (lib/kids/progress.ts) e notifica solo l'apertura di un passo.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { areasSummary } from '@/lib/kids/curriculum';
import type { KidsProgramState, KidsStepState } from '@/lib/kids/progress';
import { useIsMobile } from '@/lib/hooks';
import {
  WORLDS,
  lerpColor,
  rampColor,
  easeDepth,
  seeded,
  type WorldConfig,
} from '@/lib/paths/worlds';

// ─── Geometria: due formati ─────────────────────────────────────────────────

interface Geo {
  /** Larghezza logica del viewBox dello scenario. */
  vbW: number;
  /** Altezza in px della fascia dedicata a ogni passo. */
  band: number;
  /** Altezza della fascia finale con il traguardo. */
  finish: number;
  node: number;
  nodeCurrent: number;
  /** Mascotte nella testata. */
  headerMascot: number;
  /** Larghezza massima dell'etichetta sotto un nodo. */
  labelW: number;
  /** Dimensione della mascotte che cammina sul sentiero. */
  mascot: number;
  /** Distanza orizzontale (unita' del viewBox) fra mascotte e nodo. */
  mascotOffset: number;
  /** Spazio fra il nodo e la sua etichetta. */
  labelGap: number;
  /** Corpo del titolo nell'etichetta. */
  labelFont: number;
  /** Larghezza massima della mappa (serve solo sul telefono). */
  maxW?: number;
}

const GEO_MOBILE: Geo = {
  vbW: 390,
  band: 150,
  finish: 168,
  node: 66,
  nodeCurrent: 76,
  headerMascot: 84,
  labelW: 152,
  mascot: 70,
  mascotOffset: 78,
  labelGap: 8,
  labelFont: 11,
  maxW: 440,
};

const GEO_DESKTOP: Geo = {
  vbW: 780,
  band: 194,
  finish: 210,
  node: 88,
  nodeCurrent: 100,
  headerMascot: 116,
  labelW: 200,
  mascot: 112,
  mascotOffset: 130,
  labelGap: 10,
  labelFont: 12.5,
};

/** Serpentina: frazioni orizzontali ripetute. */
const X_PATTERN = [0.5, 0.7, 0.5, 0.3];

const xFor = (i: number, g: Geo) => X_PATTERN[i % X_PATTERN.length] * g.vbW;
const yFor = (i: number, g: Geo) => i * g.band + g.band / 2;

const TIER_LABELS = ['Cucciolo', 'Ragazzo', 'Adulto'] as const;

// ─── Il sentiero come curva percorribile ────────────────────────────────────
//
// La stessa curva serve a DUE cose: disegnare il tracciato nello scenario e
// far CAMMINARE la mascotte sopra. Quindi la geometria si calcola una volta
// sola qui e viene passata a entrambi.
//
// I nodi sono i punti di passaggio; i punti di controllo vengono da
// Catmull-Rom, cosi' le giunzioni fra un tratto e il successivo non hanno
// spigoli. `pointAt` prende una posizione GLOBALE lungo il sentiero: 0 e' il
// primo passo, 1 il secondo, ... N il traguardo. La parte intera dice su
// quale tratto siamo, la parte decimale dove.

type Point = [number, number];

interface TrailSegment {
  p1: Point;
  p2: Point;
  c1: Point;
  c2: Point;
  /** Punto del tratto a t ∈ [0,1]. */
  at: (t: number) => Point;
}

interface Trail {
  segments: TrailSegment[];
  /** Punto a una posizione globale ∈ [0, segments.length]. */
  pointAt: (position: number) => Point;
}

/** Tensione della Catmull-Rom: piu' alta = curve piu' ampie. */
const TRAIL_TENSION = 0.34;

function buildTrail(stepCount: number, g: Geo): Trail {
  const pts: Point[] = Array.from({ length: stepCount }, (_, i) => [xFor(i, g), yFor(i, g)]);
  pts.push([g.vbW / 2, stepCount * g.band + g.finish / 2]); // traguardo

  const segments: TrailSegment[] = pts.slice(0, -1).map((_, i) => {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1: Point = [
      p1[0] + (p2[0] - p0[0]) * TRAIL_TENSION * 0.5,
      p1[1] + (p2[1] - p0[1]) * TRAIL_TENSION,
    ];
    const c2: Point = [
      p2[0] - (p3[0] - p1[0]) * TRAIL_TENSION * 0.5,
      p2[1] - (p3[1] - p1[1]) * TRAIL_TENSION,
    ];
    const at = (t: number): Point => {
      const u = 1 - t;
      return [
        u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0],
        u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1],
      ];
    };
    return { p1, p2, c1, c2, at };
  });

  const pointAt = (position: number): Point => {
    if (segments.length === 0) return [g.vbW / 2, g.band / 2];
    const clamped = Math.max(0, Math.min(segments.length, position));
    if (clamped >= segments.length) return segments[segments.length - 1].p2;
    const i = Math.floor(clamped);
    return segments[i].at(clamped - i);
  };

  return { segments, pointAt };
}

/** Da 900px in su la mappa sta accanto alla colonna del riepilogo. */
const TWO_COLUMNS_AT = 900;

/**
 * Sotto questa larghezza la mappa esce dai margini della pagina e occupa
 * tutto lo schermo. Non coincide con `TWO_COLUMNS_AT`: fra 640 e 900px siamo
 * su tablet o su una finestra stretta, dove il contenuto e' gia' comodo e
 * stirare la mappa da bordo a bordo la renderebbe solo sproporzionata.
 */
const FULL_BLEED_AT = 640;

interface Props {
  state: KidsProgramState;
  /** Riceve l'indice del passo (0..11). */
  onOpenStep: (stepIndex: number) => void;
  /** Mostrato in testata quando il maestro guarda la scheda di un allievo. */
  studentName?: string;
  /**
   * Scheda del passo aperto. Su desktop PRENDE IL POSTO del riepilogo nella
   * colonna destra; sul telefono e' un foglio che sale dal basso, quindi puo'
   * stare in fondo all'albero senza spostare nulla.
   */
  detail?: ReactNode;
}

export function KidsPathMap({ state, onOpenStep, studentName, detail }: Props) {
  const isMobile = useIsMobile(TWO_COLUMNS_AT);
  const isPhone = useIsMobile(FULL_BLEED_AT);
  const g = isMobile ? GEO_MOBILE : GEO_DESKTOP;

  const world = WORLDS[state.program.level];
  const accent = state.program.colors.accent;
  const steps = state.steps;
  const totalH = steps.length * g.band + g.finish;

  // Geometria del sentiero: la calcoliamo una volta e la condividiamo fra lo
  // scenario (che la disegna) e la mascotte (che la percorre).
  const trail = useMemo(() => buildTrail(steps.length, g), [steps.length, g]);

  // Animazione di sblocco: evidenzia i passi appena diventati accessibili.
  const prevUnlocked = useRef<boolean[] | null>(null);
  const [justUnlocked, setJustUnlocked] = useState<Set<number>>(new Set());
  useEffect(() => {
    const prev = prevUnlocked.current;
    const now = steps.map((s) => s.unlocked);
    if (prev) {
      const newly = new Set<number>();
      now.forEach((u, i) => {
        if (u && prev[i] === false) newly.add(i);
      });
      if (newly.size > 0) {
        setJustUnlocked(newly);
        const t = setTimeout(() => setJustUnlocked(new Set()), 900);
        prevUnlocked.current = now;
        return () => clearTimeout(t);
      }
    }
    prevUnlocked.current = now;
  }, [steps]);

  const mappa = (
    <div
      className="relative w-full overflow-hidden mx-auto"
      style={{
        height: totalH,
        // Sul telefono la mappa arriva ai bordi dello schermo: niente tetto
        // di larghezza e niente angoli tondi, che a filo di schermo
        // lascerebbero due tacche bianche.
        maxWidth: isPhone ? undefined : g.maxW,
        borderRadius: isPhone ? 0 : 26,
        boxShadow: '0 10px 30px rgba(16,24,40,0.16)',
      }}
    >
      <SceneBackground
        world={world}
        accent={accent}
        steps={steps}
        trail={trail}
        totalH={totalH}
        g={g}
      />

      {/* Sole: alone diffuso + disco, in alto a destra */}
      <span
        aria-hidden
        className="absolute rounded-full pointer-events-none z-[1]"
        style={{
          right: isMobile ? -40 : -30,
          top: isMobile ? -50 : -60,
          width: isMobile ? 220 : 300,
          height: isMobile ? 220 : 300,
          background: `radial-gradient(circle, ${world.sunStart}88 0%, ${world.sunStart}22 45%, transparent 70%)`,
        }}
      />
      <span
        aria-hidden
        className="absolute rounded-full pointer-events-none z-[1]"
        style={{
          right: isMobile ? 40 : 66,
          top: isMobile ? 34 : 44,
          width: isMobile ? 54 : 68,
          height: isMobile ? 54 : 68,
          background: `radial-gradient(circle at 35% 32%, #FFF6D8, ${world.sunStart} 72%)`,
          boxShadow: `0 0 40px ${world.sunStart}99`,
        }}
      />

      {/* Cancelli: uno ogni 2 passi, solo quelli ancora chiusi */}
      {steps.map((s, i) =>
        s.gateAfter && !s.gateOpen ? (
          <Gate
            key={`gate-${i}`}
            index={i}
            requiredLevel={s.gateLevel ?? 0}
            currentLevel={state.levelInfo.level}
            hasEvolution={i + 1 < steps.length && steps[i + 1].tier !== s.tier}
            g={g}
          />
        ) : null
      )}

      {/* I dodici passi */}
      {steps.map((s, i) => (
        <div
          key={`${s.stage.id}-${s.number}`}
          className={`absolute z-10 flex flex-col items-center ${
            justUnlocked.has(i) ? 'animate-unlock' : ''
          }`}
          style={{
            left: `${(xFor(i, g) / g.vbW) * 100}%`,
            top: yFor(i, g),
            transform: 'translate(-50%, -50%)',
            gap: g.labelGap,
          }}
        >
          <StepNode
            step={s}
            accent={accent}
            accentDark={state.program.colors.accentDark}
            g={g}
            onTap={() => onOpenStep(i)}
          />
        </div>
      ))}

      <MascotOnPath state={state} world={world} accent={accent} trail={trail} g={g} />

      <Finish state={state} stepCount={steps.length} g={g} />
    </div>
  );

  const riepilogo = <SidePanel state={state} world={world} />;

  // ─── Una colonna: testata e mappa (il foglio del passo galleggia) ───
  //
  // Qui NON si mostra il riepilogo laterale: con 12 fasce da 150px finirebbe
  // dopo quasi duemila pixel di mappa, cioe' in un punto dove non arriva
  // nessuno. Le stesse informazioni sono gia' in testata (livello, XP, quanto
  // manca) e sulla mappa stessa (i cancelli dicono che livello serve).
  if (isMobile) {
    return (
      <div className="flex flex-col">
        <HeroHeader state={state} world={world} studentName={studentName} g={g} mobile />
        {isPhone ? (
          // Full-bleed: la mappa esce dal padding della pagina e occupa la
          // larghezza dello schermo. `calc(50% - 50vw)` funziona perche' il
          // contenitore e' centrato nel viewport, e a differenza di una
          // `transform` non crea un contenitore per gli elementi `fixed`
          // (il foglio del passo e' figlio di questo stesso albero).
          <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)' }}>{mappa}</div>
        ) : (
          mappa
        )}
        {detail}
      </div>
    );
  }

  // ─── Desktop: mappa a sinistra, colonna destra appiccicata ───
  return (
    <div className="flex flex-col">
      <HeroHeader state={state} world={world} studentName={studentName} g={g} />
      <div className="flex gap-5 items-start pb-6">
        <div className="flex-1 min-w-0">{mappa}</div>
        <aside className="w-[292px] shrink-0 sticky top-20">{detail ?? riepilogo}</aside>
      </div>
    </div>
  );
}

// ─── Mascotte: solo l'avatar, senza cornici ─────────────────────────────────

/**
 * Le grafiche in public/percorsi/ hanno il canale alfa, quindi non serve
 * ne' piastra ne' ritaglio circolare: si posa direttamente sullo sfondo, con
 * un alone morbido dietro (per staccare dai fondali scuri).
 */
function Mascot({
  world,
  tier,
  size,
  accent,
  bob,
  ground,
}: {
  world: WorldConfig;
  tier: 0 | 1 | 2;
  size: number;
  accent?: string;
  bob?: boolean;
  /** Ombra ellittica a terra: serve quando la mascotte poggia sul sentiero. */
  ground?: boolean;
}) {
  const t = world.tiers[tier];
  const aura = accent ?? t.aura;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {ground && (
        <span
          className="absolute rounded-full pointer-events-none"
          style={{
            width: size * 0.62,
            height: size * 0.14,
            left: size * 0.19,
            bottom: -size * 0.04,
            background: 'rgba(0,0,0,0.28)',
            filter: 'blur(4px)',
          }}
          aria-hidden
        />
      )}
      <span
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: -size * 0.12,
          background: `radial-gradient(circle, ${aura}4d 0%, transparent 70%)`,
          filter: 'blur(8px)',
        }}
        aria-hidden
      />
      {t.image ? (
        <Image
          src={t.image}
          alt={`${world.name} ${t.label}`}
          width={size}
          height={size}
          sizes={`${size}px`}
          className={`relative object-contain ${bob ? 'adv-bob' : ''}`}
          style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.45))' }}
        />
      ) : (
        <span
          className={`relative flex items-center justify-center w-full h-full ${bob ? 'adv-bob' : ''}`}
          style={{ fontSize: size * 0.7, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}
          aria-label={`${world.name} ${t.label}`}
        >
          {world.mascotEmoji}
        </span>
      )}
    </div>
  );
}

// ─── Testata: avatar, livello ed esperienza ─────────────────────────────────

function HeroHeader({
  state,
  world,
  studentName,
  g,
  mobile,
}: {
  state: KidsProgramState;
  world: WorldConfig;
  studentName?: string;
  g: Geo;
  mobile?: boolean;
}) {
  const c = state.program.colors;
  const li = state.levelInfo;

  return (
    <div
      className="relative overflow-hidden mb-4 text-white"
      style={{
        borderRadius: 24,
        background: `linear-gradient(112deg, ${world.hero[0]} 0%, ${world.hero[1]} 52%, ${world.hero[2]} 100%)`,
        boxShadow: '0 8px 26px rgba(16,24,40,0.14)',
      }}
    >
      <span
        aria-hidden
        className="absolute rounded-full pointer-events-none adv-glow"
        style={{
          right: -60,
          top: -110,
          width: 340,
          height: 340,
          background: `radial-gradient(circle, ${c.accent}55, transparent 65%)`,
        }}
      />

      <div className="relative flex items-center gap-5 px-5 py-5 sm:px-6">
        <Mascot world={world} tier={state.tier} size={g.headerMascot} accent={c.accent} bob />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-[0.08em] text-white"
              style={{ background: c.accent }}
            >
              {state.program.name}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">
              {TIER_LABELS[state.tier]}
            </span>
          </div>

          <h3
            className="text-[20px] sm:text-[26px] font-bold tracking-[-0.02em] mt-2 truncate"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {studentName ?? world.tagline}
          </h3>

          <div className="flex items-center gap-3.5 mt-3 flex-wrap">
            <div
              className="shrink-0 flex items-baseline gap-1.5 px-3 py-1.5 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.13)' }}
            >
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/50">
                Liv
              </span>
              <span
                className="text-[22px] sm:text-[26px] font-extrabold leading-none tabular-nums"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {li.level}
              </span>
            </div>

            <div className="flex-1" style={{ minWidth: mobile ? 140 : 180 }}>
              <div
                className="h-2.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.14)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${state.finished ? 100 : li.percent}%`,
                    background: `linear-gradient(90deg, ${c.accent}, #F5B921)`,
                  }}
                />
              </div>
              <div className="flex justify-between gap-3 mt-1.5">
                <span className="text-[11.5px] text-white/60 tabular-nums">
                  {state.finished
                    ? 'Percorso concluso'
                    : `${li.xpIntoLevel} / ${li.xpForNextLevel} XP al livello ${li.level + 1}`}
                </span>
                <span className="text-[11.5px] text-white/60 tabular-nums whitespace-nowrap">
                  {state.xp} XP totali · max {state.maxLevel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="club-stripe" />
    </div>
  );
}

// ─── Colonna destra: riepilogo ──────────────────────────────────────────────

function SidePanel({ state, world }: { state: KidsProgramState; world: WorldConfig }) {
  const c = state.program.colors;
  const li = state.levelInfo;
  const prossimoCancello = state.steps.find((s) => s.gateAfter && !s.gateOpen);
  const nextEvo = state.tierLevels.find((l) => l > li.level) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="card p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
          A che punto sei
        </p>
        <p
          className="text-[16px] font-bold mt-1.5"
          style={{ color: c.ink, fontFamily: 'var(--font-display)' }}
        >
          Livello {li.level} · {TIER_LABELS[state.tier]}
        </p>
        <p className="text-[12.5px] text-gray-500 leading-relaxed mt-1.5">
          {state.finished ? (
            <>Hai concluso tutti i 12 passi di questo percorso.</>
          ) : (
            <>
              Ti mancano{' '}
              <b style={{ color: c.accent }}>{li.xpForNextLevel - li.xpIntoLevel} XP</b> per salire
              al livello {li.level + 1}.
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <PanelChip colors={c}>{state.xp} XP totali</PanelChip>
          <PanelChip colors={c}>
            {nextEvo !== null ? `Evoluzione al livello ${nextEvo}` : 'Ultima evoluzione raggiunta'}
          </PanelChip>
        </div>
      </div>

      {prossimoCancello && (
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
            Prossimo lucchetto
          </p>
          <p className="text-[13px] font-semibold text-gray-700 mt-1.5 leading-snug">
            Dopo il passo {prossimoCancello.number} il sentiero e&#39; chiuso fino al{' '}
            <b style={{ color: c.accent }}>livello {prossimoCancello.gateLevel}</b>.
          </p>
        </div>
      )}

      <div className="card p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
          Evoluzioni
        </p>
        <ul className="mt-2 flex flex-col gap-1">
          {state.tierLevels.map((lvl, i) => {
            const raggiunta = li.level >= lvl;
            return (
              <li
                key={i}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl"
                style={{ background: raggiunta ? c.soft : 'transparent' }}
              >
                <span className="shrink-0" style={{ opacity: raggiunta ? 1 : 0.35 }}>
                  <Mascot world={world} tier={i as 0 | 1 | 2} size={36} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[12.5px] font-bold"
                    style={{ color: raggiunta ? c.accentDark : '#9AA3B5' }}
                  >
                    {TIER_LABELS[i]}
                  </span>
                  <span className="block text-[11px] text-gray-400">
                    {i === 0 ? 'di partenza' : `dal livello ${lvl}`}
                  </span>
                </span>
                {raggiunta && <CheckIcon size={15} color={c.accent} />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function PanelChip({
  children,
  colors,
}: {
  children: ReactNode;
  colors: { soft: string; accentDark: string };
}) {
  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded-md text-[10.5px] font-bold"
      style={{ background: colors.soft, color: colors.accentDark }}
    >
      {children}
    </span>
  );
}

// ─── Scenario del bioma ─────────────────────────────────────────────────────

function SceneBackground({
  world,
  accent,
  steps,
  trail,
  totalH,
  g,
}: {
  world: WorldConfig;
  accent: string;
  steps: KidsStepState[];
  trail: Trail;
  totalH: number;
  g: Geo;
}) {
  const N = steps.length;
  const bands = N + 1; // + fascia del traguardo
  const uid = `kids-${world.id}`;

  // Fondale: una sola rampa continua campionata fitta, senza fasce.
  const SAMPLES = 26;
  const skyStops = Array.from({ length: SAMPLES + 1 }, (_, k) => {
    const p = k / SAMPLES;
    return { offset: (p * 100).toFixed(1), color: rampColor(world.gradient, easeDepth(p)) };
  });

  const printsPerSegment = g.band < 170 ? 4 : 6;

  return (
    <svg
      className="absolute inset-0 w-full"
      style={{ height: totalH }}
      viewBox={`0 0 ${g.vbW} ${totalH}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          {skyStops.map((s, k) => (
            <stop key={k} offset={`${s.offset}%`} stopColor={s.color} />
          ))}
        </linearGradient>
        <linearGradient id={`${uid}-shaft`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-vignette`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0B1A10" stopOpacity="0.1" />
          <stop offset="22%" stopColor="#0B1A10" stopOpacity="0" />
          <stop offset="78%" stopColor="#0B1A10" stopOpacity="0" />
          <stop offset="100%" stopColor="#0B1A10" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={g.vbW} height={totalH} fill={`url(#${uid}-sky)`} />

      {/* Fasci di luce diagonali */}
      {Array.from({ length: 5 }).map((_, k) => {
        const x = seeded(k, 5) * g.vbW;
        const y = seeded(k, 9) * totalH * 0.85;
        const wd = 70 + seeded(k, 3) * 130;
        const points = [
          `${x},${y}`,
          `${x + wd},${y}`,
          `${x + wd * 0.45},${y + 260 + seeded(k, 11) * 200}`,
          `${x - wd * 0.2},${y + 220}`,
        ].join(' ');
        return (
          <polygon
            key={`shaft-${k}`}
            points={points}
            fill={`url(#${uid}-shaft)`}
            opacity={0.5}
            transform={`rotate(-8 ${x} ${y})`}
          />
        );
      })}

      <EdgeDecor world={world} bands={bands} lastBand={N} g={g} />

      {/* Sentiero + impronte sui tratti gia' percorsi */}
      {trail.segments.map((sg, i) => {
        const completed = steps[i]?.completed ?? false;
        return (
          <g key={`trail-${i}`}>
            <path
              d={`M ${sg.p1[0]} ${sg.p1[1]} C ${sg.c1[0]} ${sg.c1[1]}, ${sg.c2[0]} ${sg.c2[1]}, ${sg.p2[0]} ${sg.p2[1]}`}
              fill="none"
              stroke={completed ? accent : '#FFFFFF'}
              strokeWidth={6}
              strokeLinecap="round"
              opacity={completed ? 0.6 : 0.28}
            />
            {completed &&
              Array.from({ length: printsPerSegment }).map((_, k) => {
                const t = (k + 1) / (printsPerSegment + 1);
                const p = sg.at(t);
                const pn = sg.at(Math.min(1, t + 0.02));
                const ang = (Math.atan2(pn[1] - p[1], pn[0] - p[0]) * 180) / Math.PI - 90;
                const side = k % 2 === 0 ? 1 : -1;
                return (
                  <g
                    key={`print-${i}-${k}`}
                    transform={`translate(${p[0]} ${p[1]}) rotate(${ang}) translate(${side * 7} 0)`}
                    fill={accent}
                    opacity={0.9}
                  >
                    <Pawprint worldId={world.id} color={accent} />
                  </g>
                );
              })}
          </g>
        );
      })}

      <rect x="0" y="0" width={g.vbW} height={totalH} fill={`url(#${uid}-vignette)`} />
    </svg>
  );
}

/**
 * Vegetazione del bioma: SOLO SUI BORDI (primo e ultimo quinto della
 * larghezza), cosi' il centro resta libero per sentiero ed etichette. La
 * densita' cresce con la profondita', come il buio del fondale.
 */
function EdgeDecor({
  world,
  bands,
  lastBand,
  g,
}: {
  world: WorldConfig;
  bands: number;
  lastBand: number;
  g: Geo;
}) {
  const out: ReactNode[] = [];

  for (let b = 0; b < bands; b++) {
    const t = easeDepth(bands <= 1 ? 0 : b / (bands - 1));
    const y0 = b * g.band;
    const h = b === lastBand ? g.finish : g.band;
    const edge = lerpColor(world.gradient[3], world.gradient[6], Math.min(1, t + 0.15));
    const count = 2 + Math.round(t * 3);

    for (let k = 0; k < count; k++) {
      const rightSide = k % 2 === 0;
      const cx = rightSide
        ? seeded(b * 7 + k, 21) * g.vbW * 0.2
        : g.vbW - seeded(b * 7 + k, 33) * g.vbW * 0.2;
      const cy = y0 + 16 + seeded(b * 7 + k, 41) * (h - 32);
      const key = `veg-${b}-${k}`;

      if (world.id === 'cerbiatto') {
        // Chioma a goccia: alberi visti in controluce.
        const hh = 34 + seeded(b + k, 55) * 34 + t * 20;
        const ww = 24 + seeded(b + k, 61) * 14;
        out.push(
          <path
            key={key}
            d={`M ${cx - ww / 2} ${cy} Q ${cx} ${cy - hh * 0.55} ${cx} ${cy - hh} Q ${cx} ${
              cy - hh * 0.55
            } ${cx + ww / 2} ${cy} Z`}
            fill={edge}
            opacity={0.55}
          />
        );
      } else if (world.id === 'delfino') {
        // Bolle che risalgono.
        out.push(
          <circle
            key={key}
            cx={cx}
            cy={cy}
            r={4 + seeded(b + k, 55) * 10}
            fill="#FFFFFF"
            opacity={0.13}
          />
        );
      } else {
        // Ninfee: ellisse schiacciata + riflesso.
        const r = 16 + seeded(b + k, 55) * 18;
        out.push(
          <g key={key}>
            <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.4} fill={edge} opacity={0.6} />
            <ellipse
              cx={cx}
              cy={cy - r * 0.12}
              rx={r * 0.72}
              ry={r * 0.26}
              fill="#FFFFFF"
              opacity={0.09}
            />
          </g>
        );
      }
    }
  }

  return <>{out}</>;
}

/** L'impronta lasciata dalla mascotte del mondo. */
function Pawprint({ worldId, color }: { worldId: string; color: string }) {
  if (worldId === 'delfino') {
    return <path d="M 0 -5.4 Q 3.2 -1.4 3.4 4.2 Q 1.2 2.4 -1.4 3.4 Q -0.6 -1.2 0 -5.4 Z" />;
  }
  if (worldId === 'cerbiatto') {
    return (
      <>
        <path d="M -2.6 -3 Q -3.4 3 -0.6 4 Q -0.2 0 -0.6 -3 Z" />
        <path d="M 2.6 -3 Q 3.4 3 0.6 4 Q 0.2 0 0.6 -3 Z" />
      </>
    );
  }
  return (
    <>
      <ellipse cx={0} cy={-0.6} rx={2.6} ry={3.4} />
      <path
        d="M -3.6 3.4 L -1.4 1 M 0 5 L 0 2.2 M 3.6 3.4 L 1.4 1"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </>
  );
}

// ─── La mascotte che cammina sul sentiero ───────────────────────────────

/**
 * Dove si trova l'avatar sul sentiero.
 *
 * `position` e' la posizione GLOBALE lungo la curva (0 = primo passo, N =
 * traguardo), `side` dice da quale lato del sentiero sta: +1 a destra, -1 a
 * sinistra. Teniamo il lato come NUMERO e non come pixel perche' durante il
 * cammino lo interpoliamo: passando da +1 a -1 la mascotte attraversa il
 * sentiero invece di teletrasportarsi, e il valore resta valido anche se
 * cambia la geometria (telefono ↔ desktop).
 */
interface MascotAnchor {
  position: number;
  side: number;
}

/**
 * L'avatar accanto al PASSO CORRENTE (il primo sbloccato e non concluso),
 * oppure sul traguardo a percorso finito. Quando il passo corrente avanza,
 * la mascotte cammina lungo la curva fino alla nuova posizione.
 */
function MascotOnPath({
  state,
  world,
  accent,
  trail,
  g,
}: {
  state: KidsProgramState;
  world: WorldConfig;
  accent: string;
  trail: Trail;
  g: Geo;
}) {
  const stepCount = state.steps.length;
  const lastSegment = trail.segments.length;

  const anchorFor = useCallback(
    (index: number): MascotAnchor => {
      const atFinish = index >= stepCount;
      const x = atFinish ? g.vbW / 2 : xFor(index, g);
      // Si ferma sul lato dove c'e' piu' spazio, per non coprire il nodo.
      return { position: Math.min(index, lastSegment), side: x <= g.vbW / 2 ? 1 : -1 };
    },
    [g, stepCount, lastSegment]
  );

  const target = state.finished ? stepCount : Math.max(0, state.currentStepIndex);

  const [anchor, setAnchor] = useState<MascotAnchor>(() => anchorFor(target));
  const anchorRef = useRef<MascotAnchor>(anchor);
  const targetRef = useRef(target);

  useEffect(() => {
    if (targetRef.current === target) return;
    targetRef.current = target;

    const from = anchorRef.current;
    const to = anchorFor(target);

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      anchorRef.current = to;
      setAnchor(to);
      return;
    }

    // Il cammino dura in proporzione alla strada da fare, con un tetto: se
    // il maestro spunta tutto in un colpo non si aspettano dieci secondi.
    const passi = Math.abs(to.position - from.position);
    const durata = Math.min(2600, 480 + passi * 620);
    const inizio = performance.now();
    let raf = 0;

    const passo = (ora: number) => {
      const u = Math.min(1, (ora - inizio) / durata);
      // easeInOutQuad: parte piano, prende ritmo, si posa piano.
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const next: MascotAnchor = {
        position: from.position + (to.position - from.position) * e,
        side: from.side + (to.side - from.side) * e,
      };
      anchorRef.current = next;
      setAnchor(next);
      if (u < 1) raf = requestAnimationFrame(passo);
    };

    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [target, anchorFor]);

  // Cambio di formato (telefono ↔ desktop): la posizione lungo la curva resta
  // valida, ma va ricalcolata sulla nuova geometria al prossimo render.
  const [x, y] = trail.pointAt(anchor.position);
  const tierLabel = world.tiers[state.tier].label;

  return (
    <div
      className="absolute z-20 pointer-events-none flex flex-col items-center"
      style={{
        left: `${((x + anchor.side * g.mascotOffset) / g.vbW) * 100}%`,
        // Alzata rispetto al centro del nodo: cosi' la mascotte gli sta
        // accanto senza finire sopra l'etichetta, che sta sotto.
        top: y - g.node * 0.28,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <Mascot world={world} tier={state.tier} size={g.mascot} accent={accent} bob ground />
      <span
        className="mt-0.5 whitespace-nowrap px-2 py-0.5 rounded-full bg-white text-[9px] font-extrabold uppercase tracking-[0.06em] text-gray-800"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.28)' }}
      >
        {tierLabel}
      </span>
    </div>
  );
}

// ─── Nodo di un passo ───────────────────────────────────────────────────────

function StepNode({
  step,
  accent,
  accentDark,
  g,
  onTap,
}: {
  step: KidsStepState;
  accent: string;
  accentDark: string;
  g: Geo;
  onTap: () => void;
}) {
  const size = step.current ? g.nodeCurrent : g.node;
  const locked = !step.unlocked;

  const face = step.completed ? accent : locked ? '#E7E9EE' : '#FFFFFF';
  const edge = step.completed
    ? lerpColor(accent, '#000000', 0.34)
    : locked
      ? '#B6BDC9'
      : accentDark;

  const titolo = capitalize(areasSummary(step.areas));

  return (
    <>
      <button
        type="button"
        onClick={onTap}
        className="adv-node relative rounded-full flex items-center justify-center"
        style={{
          width: size,
          height: size,
          background: face,
          boxShadow: locked
            ? 'inset 0 -4px 0 rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.2)'
            : `0 6px 0 ${edge}, 0 12px 22px rgba(0,0,0,0.3)`,
        }}
        aria-label={`Passo ${step.number}: ${step.done} obiettivi su ${step.total}`}
      >
        {step.current && (
          <span
            className="adv-pulse-ring absolute rounded-full border-[3px] pointer-events-none"
            style={{ inset: -10, borderColor: '#F5B921' }}
            aria-hidden
          />
        )}

        {step.completed ? (
          <CheckIcon size={size * 0.36} color="#FFFFFF" strokeWidth={3.4} />
        ) : locked ? (
          <LockIcon size={size * 0.3} color="#98A2B3" />
        ) : (
          <span className="flex flex-col items-center leading-none">
            <span
              className="font-extrabold uppercase tracking-[0.12em]"
              style={{ fontSize: size * 0.135, color: '#9AA3B5' }}
            >
              passo
            </span>
            <span
              className="font-extrabold tabular-nums"
              style={{ fontSize: size * 0.36, color: accent, fontFamily: 'var(--font-display)' }}
            >
              {step.number}
            </span>
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onTap}
        className="text-center flex flex-col gap-px"
        style={{
          maxWidth: g.labelW,
          padding: '7px 12px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.96)',
          boxShadow: '0 3px 12px rgba(0,0,0,0.22)',
          opacity: locked ? 0.8 : 1,
        }}
      >
        <span
          className="font-bold leading-tight line-clamp-2"
          style={{
            fontSize: g.labelFont,
            fontFamily: 'var(--font-display)',
            color: locked ? '#98A2B3' : '#18223A',
          }}
        >
          {titolo}
        </span>
        <span
          className="text-[9.5px] font-bold uppercase tracking-[0.09em] tabular-nums leading-tight"
          style={{ color: locked ? '#B6BDC9' : step.completed ? accentDark : '#9AA3B5' }}
        >
          {locked ? 'Bloccato' : `${step.done}/${step.total} · +${step.xpPerObjective} XP`}
        </span>
      </button>
    </>
  );
}

// ─── Cancello chiuso: una linea che taglia la mappa ───────────────────────

/**
 * Si vede SOLO finche' il cancello e' chiuso: dice quale livello serve e
 * quanto manca. Il chiamante non lo monta nemmeno quando il cancello e'
 * aperto, quindi qui non esiste un ramo "aperto".
 */
function Gate({
  index,
  requiredLevel,
  currentLevel,
  hasEvolution,
  g,
}: {
  index: number;
  requiredLevel: number;
  currentLevel: number;
  /** Superato questo cancello l'avatar cambia stadio: si usa come richiamo. */
  hasEvolution: boolean;
  g: Geo;
}) {
  const mancanti = Math.max(0, requiredLevel - currentLevel);
  const hair = (
    <span
      className="flex-1 h-px"
      style={{
        background:
          'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.6), rgba(255,255,255,0))',
      }}
      aria-hidden
    />
  );

  return (
    <div
      className="absolute left-0 right-0 z-[15] pointer-events-none"
      style={{ top: index * g.band + g.band, transform: 'translateY(-50%)' }}
    >
      <div className="flex items-center gap-2.5 px-4">
        {hair}
        <div
          className="flex items-center gap-2 shrink-0 rounded-full whitespace-nowrap px-3 py-1.5 text-[11.5px] font-bold"
          style={{
            background: 'rgba(255,255,255,0.94)',
            color: '#475467',
            boxShadow: '0 4px 14px rgba(9,16,24,0.28)',
          }}
        >
          <LockIcon size={14} color="#475467" />
          <span>Serve il livello {requiredLevel}</span>
          <span
            className="text-[10px] font-bold text-gray-400 pl-2"
            style={{ borderLeft: '1px solid #E4E7EE' }}
          >
            {mancanti === 1 ? 'ancora 1 livello' : `ancora ${mancanti} livelli`}
            {hasEvolution ? ' · nuovo avatar' : ''}
          </span>
        </div>
        {hair}
      </div>
    </div>
  );
}

// ─── Traguardo ──────────────────────────────────────────────────────────────

function Finish({
  state,
  stepCount,
  g,
}: {
  state: KidsProgramState;
  stepCount: number;
  g: Geo;
}) {
  const done = state.finished;
  const next = state.nextLevel;
  const passiMancanti = stepCount - state.completedSteps;

  return (
    <div
      className="absolute z-10 flex flex-col items-center gap-2.5"
      style={{
        left: '50%',
        top: stepCount * g.band + g.finish / 2,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className={`rounded-full flex items-center justify-center ${done ? 'adv-bob' : ''}`}
        style={{
          width: 68,
          height: 68,
          background: done ? 'radial-gradient(circle, #FDE68A, #F5B921)' : 'rgba(255,255,255,0.16)',
          border: done ? 'none' : '2px dashed rgba(255,255,255,0.55)',
          color: done ? '#7A4E05' : 'rgba(255,255,255,0.8)',
          boxShadow: done ? '0 6px 0 #C8920F, 0 14px 28px rgba(245,185,33,0.45)' : 'none',
        }}
      >
        <FlagIcon />
      </div>
      <div
        className="px-3.5 py-2 rounded-xl text-center max-w-[240px] flex flex-col gap-0.5"
        style={{ background: 'rgba(255,255,255,0.96)', boxShadow: '0 3px 12px rgba(0,0,0,0.22)' }}
      >
        <span
          className="text-[12.5px] font-bold leading-tight"
          style={{
            color: done ? state.program.colors.accentDark : '#475467',
            fontFamily: 'var(--font-display)',
          }}
        >
          {done ? `Livello ${state.maxLevel} raggiunto!` : `Traguardo · livello ${state.maxLevel}`}
        </span>
        <span className="text-[10.5px] text-gray-400 leading-snug">
          {done
            ? next
              ? `Si passa al percorso ${capitalize(next.toLowerCase())}`
              : 'Ultimo percorso del Diario concluso'
            : passiMancanti === 1
              ? 'ancora 1 passo'
              : `ancora ${passiMancanti} passi`}
        </span>
      </div>
    </div>
  );
}

// ─── Utility ────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Icone ──────────────────────────────────────────────────────────────────

function LockIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.6"
      strokeLinecap="round"
      className="shrink-0"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function CheckIcon({
  size = 26,
  color = 'currentColor',
  strokeWidth = 3,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 21V4" />
      <path d="M6 4h11l-1.5 4L17 12H6" />
    </svg>
  );
}
