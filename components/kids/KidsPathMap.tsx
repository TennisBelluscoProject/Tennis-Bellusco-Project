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
 *  - Ogni 2 PASSI il sentiero e' tagliato da una SOGLIA: una riga netta da
 *    bordo a bordo col nome della tappa e il livello che la apre. Si vede SOLO
 *    finche' la tappa e' chiusa — una soglia superata non ha piu' niente da
 *    dire, quindi sparisce e non lascia nemmeno lo spazio che occupava.
 *  - L'AVATAR sta in due posti: nella TESTATA, come "faccia" del percorso
 *    accanto al livello e alla barra dell'esperienza, e SUL SENTIERO, accanto
 *    al passo corrente. Quando il passo corrente cambia non salta: PERCORRE
 *    la curva fino alla nuova posizione, cosi' si vede la strada fatta. Si
 *    evolve a livelli prestabiliti (`state.tierLevels`).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA GEOMETRIA STA ALTROVE
 *
 * Formati, impilamento verticale e curva del sentiero vivono in
 * `lib/kids/map-layout.ts`: sono funzioni pure, quindi le regole di non
 * sovrapposizione si verificano con un test invece che con uno screenshot.
 * Qui dentro resta solo il disegno.
 *
 * In breve: le y NON sono `indice * altezza_banda`. Ogni riga (passo, divisore
 * di sezione, traguardo) dichiara la propria altezza e `buildLayout` le impila,
 * quindi niente puo' sovrapporsi per costruzione. E il ritmo e' IRREGOLARE di
 * proposito: sette ampiezze orizzontali e cinque altezze, lunghezze prime fra
 * loro, cosi' il sentiero ondeggia invece di rimbalzare fra due sponde alla
 * stessa identica distanza.
 *
 * DUE FORMATI
 *  TELEFONO — la mappa esce dai margini e occupa tutta la larghezza dello
 *  schermo (classe `.full-bleed`, vedi globals.css). Niente riepilogo in fondo:
 *  con dodici righe finirebbe dopo quasi duemila pixel di scorrimento, dove non
 *  arriva nessuno.
 *  DESKTOP (da 900px) — sentiero piu' ampio e COLONNA DESTRA appiccicata col
 *  riepilogo, oppure la scheda del passo aperto, passata dal chiamante con la
 *  prop `detail`.
 *
 * La geometria dei due formati e' raccolta in `GEO_MOBILE` / `GEO_DESKTOP`:
 * niente numeri magici sparsi nel componente.
 *
 * Componente PRESENTAZIONALE: riceve lo stato gia' calcolato
 * (lib/kids/progress.ts) e notifica solo l'apertura di un passo.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Image from 'next/image';
import { Zap } from 'lucide-react';
import type { KidsProgramState, KidsStepState } from '@/lib/kids/progress';
import { useIsMobile } from '@/lib/hooks';
import {
  GEO_DESKTOP,
  GEO_MOBILE,
  buildLayout,
  buildTrail,
  xFor,
  type Geo,
  type Trail,
} from '@/lib/kids/map-layout';
import {
  WORLDS,
  lerpColor,
  rampColor,
  easeDepth,
  seeded,
  type WorldConfig,
} from '@/lib/paths/worlds';
import { EdgeDecor } from './BiomeScenery';

const TIER_LABELS = ['Cucciolo', 'Ragazzo', 'Adulto'] as const;

/** Da 900px in su la mappa sta accanto alla colonna del riepilogo. */
const TWO_COLUMNS_AT = 900;

/**
 * Sotto questa larghezza la mappa esce dai margini della pagina e occupa
 * tutto lo schermo.
 *
 * Coincide di proposito con `TWO_COLUMNS_AT`: la soglia e' UNA SOLA, cioe'
 * "la mappa e' da sola in colonna". Tenerne due separate voleva dire avere
 * una fascia (640-900px) in cui la mappa era gia' nel formato stretto ma
 * restava incorniciata dal gutter, con due strisce bianche ai lati.
 */
export const FULL_BLEED_AT = TWO_COLUMNS_AT;

/**
 * Insieme vuoto condiviso: evita che il valore predefinito della prop crei un
 * `Set` nuovo a ogni render, cosa che romperebbe le memoizzazioni a valle.
 */
const EMPTY_KEYS: ReadonlySet<string> = new Set<string>();

/**
 * Quanti obiettivi di questo passo sono "In corso" nel Kanban.
 *
 * Si contano solo quelli NON ancora spuntati: un obiettivo concluso non e'
 * piu' in lavorazione, e sul database la sua card e' gia' passata a
 * "Conclusi". Contarlo lascerebbe il pallino acceso su un passo finito.
 */
function contaInCorso(step: KidsStepState, inProgressKeys: ReadonlySet<string>): number {
  if (inProgressKeys.size === 0) return 0;
  let n = 0;
  for (const o of step.objectives) {
    if (inProgressKeys.has(o.key)) n += 1;
  }
  return n;
}

interface Props {
  state: KidsProgramState;
  /**
   * Obiettivi che l'allievo ha messo "In corso" nel Kanban.
   *
   * La mappa non li scrive mai: e' un dato che arriva dall'altra schermata e
   * qui viene solo MOSTRATO, perche' il nodo dica non solo "quanto manca" ma
   * anche "a cosa stai lavorando adesso".
   */
  inProgressKeys?: ReadonlySet<string>;
  /** Riceve l'indice del passo (0..11). */
  onOpenStep: (stepIndex: number) => void;
  /**
   * Scheda del passo aperto. Su desktop PRENDE IL POSTO del riepilogo nella
   * colonna destra; sul telefono e' un foglio che sale dal basso, quindi puo'
   * stare in fondo all'albero senza spostare nulla.
   */
  detail?: ReactNode;
}

export function KidsPathMap({
  state,
  inProgressKeys = EMPTY_KEYS,
  onOpenStep,
  detail,
}: Props) {
  const isMobile = useIsMobile(TWO_COLUMNS_AT);
  const isPhone = useIsMobile(FULL_BLEED_AT);
  const g = isMobile ? GEO_MOBILE : GEO_DESKTOP;

  const world = WORLDS[state.program.level];
  const accent = state.program.colors.accent;
  const steps = state.steps;

  // Verticale e sentiero: si calcolano una volta e li leggono tutti. Il layout
  // dipende anche da QUALI tappe sono ancora chiuse: una soglia superata non
  // occupa piu' spazio, quindi la mappa si accorcia man mano che si avanza.
  const layout = useMemo(
    () =>
      buildLayout(
        steps.map((s) => ({ divider: s.half === 0 && !s.unlocked })),
        g
      ),
    [steps, g]
  );
  const trail = useMemo(() => buildTrail(layout, g), [layout, g]);
  const totalH = layout.totalH;

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
        // di larghezza, niente angoli tondi (a filo di schermo lascerebbero
        // due tacche bianche) e niente ombra, che sul bordo del viewport si
        // vedrebbe solo come una riga grigia.
        maxWidth: isPhone ? undefined : g.maxW,
        borderRadius: isPhone ? 0 : 26,
        boxShadow: isPhone ? 'none' : '0 10px 30px rgba(16,24,40,0.16)',
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

      {/* Sole: alone diffuso + disco, in alto a destra. Sul telefono cade nel
          cielo libero di `topPad`, sopra il primo passo. */}
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
          right: isMobile ? 34 : 66,
          top: isMobile ? 14 : 44,
          width: isMobile ? 50 : 68,
          height: isMobile ? 50 : 68,
          background: `radial-gradient(circle at 35% 32%, #FFF6D8, ${world.sunStart} 72%)`,
          boxShadow: `0 0 40px ${world.sunStart}99`,
        }}
      />

      {/* Soglie: solo le tappe ancora chiuse. Superata, la soglia sparisce */}
      {steps.map((s, i) => {
        const y = layout.dividerY[i];
        if (y === null) return null;
        const stage = state.stages[s.stageIndex];
        const precedente = state.stages[s.stageIndex - 1];
        return (
          <SectionDivider
            key={`sez-${i}`}
            y={y}
            titolo={stage.stage.court}
            sottotitolo={stage.stage.label}
            requiredLevel={precedente?.gateLevel ?? null}
          />
        );
      })}

      {/* I dodici passi */}
      {steps.map((s, i) => (
        <StepMarker
          key={`${s.stage.id}-${s.number}`}
          step={s}
          inCorso={contaInCorso(s, inProgressKeys)}
          x={xFor(i, g)}
          y={layout.stepY[i]}
          accent={accent}
          accentDark={state.program.colors.accentDark}
          g={g}
          justUnlocked={justUnlocked.has(i)}
          onTap={() => onOpenStep(i)}
        />
      ))}

      <MascotOnPath state={state} world={world} accent={accent} trail={trail} g={g} />

      <Finish state={state} y={layout.finishY} stepCount={steps.length} g={g} />
    </div>
  );

  const riepilogo = <SidePanel state={state} world={world} />;

  // ─── Una colonna: testata e mappa (il foglio del passo galleggia) ───
  //
  // Qui NON si mostra il riepilogo laterale: con dodici righe finirebbe dopo
  // quasi duemila pixel di mappa, cioe' in un punto dove non arriva nessuno.
  // Le stesse informazioni sono gia' in testata (livello, XP, quanto manca) e
  // sulla mappa stessa (i cancelli dicono che livello serve).
  if (isMobile) {
    // Sul telefono testata e mappa sono UN BLOCCO SOLO: stessa larghezza
    // (quella dello schermo), attaccate, senza cornice fra le due. La scheda
    // dell'allievo ha gia' il suo riquadro blu tondo piu' in alto; ripeterne
    // un secondo qui sotto spezzava la pagina in due card sovrapposte invece
    // di far leggere la testata come l'intestazione della mappa.
    const blocco = (
      <>
        <HeroHeader state={state} world={world} g={g} mobile seamless={isPhone} />
        {mappa}
      </>
    );

    return (
      <div className="flex flex-col">
        {isPhone ? (
          // `.full-bleed` (globals.css) annulla il gutter di pagina con un
          // margine negativo. Volutamente NON usa `transform`: il foglio del
          // passo e' `position: fixed` ed e' figlio di questo stesso albero,
          // quindi un antenato trasformato lo incollerebbe alla mappa.
          <div className="full-bleed">{blocco}</div>
        ) : (
          blocco
        )}
        {detail}
      </div>
    );
  }

  // ─── Desktop: mappa a sinistra, colonna destra appiccicata ───
  return (
    <div className="flex flex-col">
      <HeroHeader state={state} world={world} g={g} />
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
  glow = true,
}: {
  world: WorldConfig;
  tier: 0 | 1 | 2;
  size: number;
  accent?: string;
  bob?: boolean;
  /** Ombra ellittica a terra: serve quando la mascotte poggia sul sentiero. */
  ground?: boolean;
  /**
   * Alone colorato dietro l'avatar. Serve a staccarlo dai fondali scuri della
   * mappa; in testata invece il fondo e' gia' uniforme e l'alone si legge solo
   * come una macchia di nebbia intorno alla sagoma.
   */
  glow?: boolean;
}) {
  const t = world.tiers[tier];
  const aura = accent ?? t.aura;

  // Il riquadro resta di `size` — e' lui a dettare posizione, ombra a terra ed
  // etichetta — mentre l'immagine puo' essere piu' grande e sbordare. Vedi il
  // commento su `fit` in lib/paths/worlds.ts: serve a pareggiare a occhio
  // animali di forma molto diversa dentro lo stesso riquadro quadrato.
  const fit = t.fit ?? 1;
  const imgSize = Math.round(size * fit);
  const sbordo = (imgSize - size) / 2;

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
      {glow && (
        <span
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: -size * 0.12,
            background: `radial-gradient(circle, ${aura}4d 0%, transparent 70%)`,
            filter: 'blur(8px)',
          }}
          aria-hidden
        />
      )}
      {t.image ? (
        <Image
          src={t.image}
          alt={`${world.name} ${t.label}`}
          width={imgSize}
          height={imgSize}
          sizes={`${imgSize}px`}
          className={`absolute max-w-none object-contain ${bob ? 'adv-bob' : ''}`}
          style={{
            width: imgSize,
            height: imgSize,
            // Centrata sul riquadro: sborda in modo simmetrico.
            left: -sbordo,
            top: -sbordo,
            filter: glow
              ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.45))'
              : 'drop-shadow(0 4px 8px rgba(0,0,0,0.32))',
          }}
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

// ─── Testata: avatar ed esperienza ──────────────────────────────────────────

/**
 * Dice DUE cose sole: chi sei diventato (l'avatar, col suo stadio) e a che
 * livello sei. Tutto il resto e' contorno.
 *
 * Il nome dell'allievo NON compare: nella scheda sta gia' nel riquadro blu
 * poco sopra, e ripeterlo qui rubava il posto centrale al numero del livello,
 * che e' l'unica cosa che cambia mentre si spuntano gli obiettivi.
 */
function HeroHeader({
  state,
  world,
  g,
  mobile,
  seamless,
}: {
  state: KidsProgramState;
  world: WorldConfig;
  g: Geo;
  mobile?: boolean;
  /**
   * Testata SALDATA alla mappa: niente angoli tondi, niente stacco sotto,
   * niente riga tricolore. Le due parti si leggono come un unico pannello a
   * tutta larghezza invece che come due card impilate.
   */
  seamless?: boolean;
}) {
  const c = state.program.colors;
  const li = state.levelInfo;
  const pieno = state.finished ? 100 : li.percent;

  return (
    <div
      className={`relative overflow-hidden text-white ${seamless ? '' : 'mb-4'}`}
      style={{
        borderRadius: seamless ? 0 : 24,
        background: `linear-gradient(112deg, ${world.hero[0]} 0%, ${world.hero[1]} 52%, ${world.hero[2]} 100%)`,
        boxShadow: seamless ? 'none' : '0 8px 26px rgba(16,24,40,0.14)',
      }}
    >
      <div className="flex items-center gap-4 px-5 py-4 sm:px-6 sm:py-5">
        <Mascot world={world} tier={state.tier} size={g.headerMascot} bob glow={false} />

        <div className="flex-1 min-w-0">
          {/* Percorso e stadio raggiunto dall'avatar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-[0.08em] text-white"
              style={{ background: c.accent }}
            >
              {state.program.name}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
              {TIER_LABELS[state.tier]}
            </span>
          </div>

          {/* Il livello: il numero grande e' il soggetto della testata */}
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
              Liv
            </span>
            <span
              className="font-extrabold leading-none tabular-nums"
              style={{ fontSize: mobile ? 42 : 52, fontFamily: 'var(--font-display)' }}
            >
              {li.level}
            </span>
            <span className="ml-auto text-[10.5px] font-semibold text-white/40 tabular-nums whitespace-nowrap">
              max {state.maxLevel}
            </span>
          </div>

          {/* Esperienza */}
          <div className="mt-2.5">
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.16)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pieno}%`,
                  background: `linear-gradient(90deg, ${c.accent}, #F5B921)`,
                }}
              />
            </div>
            <p className="text-[11px] text-white/55 tabular-nums mt-1.5 truncate">
              {state.finished
                ? 'Percorso concluso'
                : `${li.xpIntoLevel} / ${li.xpForNextLevel} XP al livello ${li.level + 1}`}
              <span className="text-white/30"> · {state.xp} XP totali</span>
            </p>
          </div>
        </div>
      </div>

      {!seamless && <div className="club-stripe" />}
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

      <EdgeDecor world={world} totalH={totalH} g={g} />

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
 * Vegetazione del bioma: SOLO SUI BORDI, cosi' il centro resta libero per
 * sentiero, nodi ed etichette. Il disegno vero sta in `BiomeScenery.tsx`:
 * e' una libreria di sagome (alghe, abeti, canneti, fauna) e occupava piu'
 * spazio di tutto il resto di questo file.
 */

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
      // `interno` punta verso il centro della mappa. Con l'etichetta sotto al
      // nodo (desktop) il centro e' lo spazio libero; con l'etichetta di
      // fianco (telefono) il centro e' occupato e la mascotte va all'esterno.
      const interno = x <= g.vbW / 2 ? 1 : -1;
      return {
        position: Math.min(index, lastSegment),
        side: g.mascotOuter ? -interno : interno,
      };
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

  // Ultimo tratto: la mascotte rientra al centro e SALE sopra il traguardo,
  // invece di finirgli addosso. `salita` va da 0 a 1 lungo l'ultimo tratto,
  // quindi il movimento resta continuo: nessuno scatto all'arrivo.
  const salita =
    lastSegment > 0 ? Math.max(0, Math.min(1, anchor.position - (lastSegment - 1))) : 0;
  const scostamento = anchor.side * g.mascotOffset * (1 - salita);
  // Quanto deve alzarsi per POSARSI SOPRA il disco del traguardo invece di
  // finirgli addosso: mezzo disco piu' mezza mascotte. E' geometria, non una
  // frazione tarata a occhio, quindi resta giusta se cambiano le due misure.
  const salitaFinale = g.finishNode / 2 + g.mascot / 2;

  return (
    <div
      className="absolute z-20 pointer-events-none flex flex-col items-center"
      style={{
        left: `${((x + scostamento) / g.vbW) * 100}%`,
        // Alzata rispetto al centro del nodo: cosi' la mascotte gli sta
        // accanto senza coprirlo.
        top: y - g.node * 0.28 - salita * salitaFinale,
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

// ─── Un passo sulla mappa ─────────────────────────────────────────────────

/**
 * Solo il nodo, centrato sul punto del sentiero.
 *
 * Non c'e' piu' un'etichetta col titolo del passo: il titolo appartiene alla
 * TAPPA e sta sul divisore che la apre (vedi SectionDivider). Sul nodo bastano
 * il numero e lo stato — fatto, in corso, chiuso — e il dettaglio si apre al
 * tocco. Toglierla ha liberato meta' della larghezza, ed e' quello che permette
 * al sentiero di ondeggiare invece di rimbalzare fra due sponde.
 */
function StepMarker({
  step,
  inCorso,
  x,
  y,
  accent,
  accentDark,
  g,
  justUnlocked,
  onTap,
}: {
  step: KidsStepState;
  /** Quanti obiettivi del passo sono "In corso" nel Kanban. */
  inCorso: number;
  x: number;
  y: number;
  accent: string;
  accentDark: string;
  g: Geo;
  justUnlocked: boolean;
  onTap: () => void;
}) {
  const size = step.current ? g.nodeCurrent : g.node;

  // Il segno non ha senso su un passo chiuso (non ci sono card) ne' su uno
  // gia' concluso (le card sono tutte in "Conclusi").
  const mostraInCorso = inCorso > 0 && step.unlocked && !step.completed;

  return (
    <div
      className="absolute z-10"
      style={{
        left: `${(x / g.vbW) * 100}%`,
        top: y,
        // L'animazione di sblocco anima `transform`, e il centraggio sul punto
        // del sentiero USA `transform`: sullo stesso elemento si
        // escluderebbero a vicenda. Percio' il posizionamento sta fuori e
        // l'animazione dentro.
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className={justUnlocked ? 'animate-unlock' : ''}>
        <div className="relative">
          {step.current && (
            // "Sei qui": una punta che indica il nodo dall'alto, non un cerchio
            // intorno. Un anello compete col bordo del nodo, che gia' porta
            // rilievo e colore; una freccia sta in uno spazio vuoto e si legge
            // subito anche in mezzo al verde del fondale.
            <span
              aria-hidden
              className="absolute left-1/2 pointer-events-none"
              style={{ bottom: size + 7, transform: 'translateX(-50%)' }}
            >
              {/* Il salterello anima `transform`, e il centraggio pure: se
                  stessero sullo stesso elemento si annullerebbero. */}
              <span className="adv-bob block">
                <svg width="24" height="16" viewBox="0 0 24 16">
                  <path
                    d="M3.5 3 L12 11.5 L20.5 3"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.7"
                  />
                  <path
                    d="M3.5 3 L12 11.5 L20.5 3"
                    fill="none"
                    stroke={accent}
                    strokeWidth="4.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </span>
          )}

          <StepNode
            step={step}
            accent={accent}
            accentDark={accentDark}
            size={size}
            onTap={onTap}
          />

          {/* "Ci stai lavorando": pastiglia ambra col fulmine, in alto a
              destra del nodo.

              Ambra e fulmine NON sono scelte estetiche: sono esattamente il
              colore (`--warning`) e l'icona che la colonna "In corso" usa nel
              Kanban. Due schermate diverse che parlano della stessa cosa
              devono usare lo stesso segno, altrimenti l'allievo deve impararlo
              due volte.

              Sta FUORI dal bottone del nodo perche' non e' un comando: e'
              un'etichetta. Cliccandoci sopra si apre comunque il passo, visto
              che non intercetta il puntatore. */}
          {mostraInCorso && (
            <span
              aria-hidden
              className="absolute pointer-events-none flex items-center justify-center rounded-full"
              style={{
                top: -2,
                right: -3,
                minWidth: size * 0.36,
                height: size * 0.36,
                padding: inCorso > 1 ? `0 ${size * 0.08}px` : 0,
                background: 'var(--warning)',
                border: '2.5px solid #FFFFFF',
                boxShadow: '0 2px 6px rgba(9,16,24,0.32)',
              }}
            >
              {inCorso > 1 ? (
                <span
                  className="font-extrabold tabular-nums leading-none text-white"
                  style={{ fontSize: size * 0.19 }}
                >
                  {inCorso}
                </span>
              ) : (
                <Zap size={size * 0.2} strokeWidth={3} color="#FFFFFF" fill="#FFFFFF" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Nodo di un passo ───────────────────────────────────────────────────────

function StepNode({
  step,
  accent,
  accentDark,
  size,
  onTap,
}: {
  step: KidsStepState;
  accent: string;
  accentDark: string;
  size: number;
  onTap: () => void;
}) {
  const locked = !step.unlocked;

  const face = step.completed ? accent : locked ? '#E7E9EE' : '#FFFFFF';
  const edge = step.completed
    ? lerpColor(accent, '#000000', 0.34)
    : locked
      ? '#B6BDC9'
      : accentDark;

  // Il nodo corrente e' gia' piu' grande degli altri (`nodeCurrent`): il resto
  // lo fa la punta che lo indica dall'alto, in StepMarker.
  const rilievo = locked
    ? 'inset 0 -4px 0 rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.2)'
    : `0 6px 0 ${edge}, 0 12px 22px rgba(0,0,0,0.3)`;

  return (
    <button
      type="button"
      onClick={onTap}
      className="adv-node relative rounded-full flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: face,
        boxShadow: rilievo,
      }}
      aria-label={`Passo ${step.number}: ${step.done} obiettivi su ${step.total}`}
    >
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
  );
}

// ─── Soglia di una tappa chiusa ───────────────────────────────────────────

/**
 * Sbarra il sentiero davanti a una tappa ancora chiusa e dice a che livello si
 * apre.
 *
 * Esiste SOLO da chiusa. Il chiamante non la monta nemmeno una volta superata,
 * e `buildLayout` non le riserva piu' spazio: la mappa si ricompatta. Tenerla
 * anche dopo voleva dire disseminare il sentiero di sbarramenti gia' passati e
 * di targhette che ripetono quello che il nodo sotto dice gia'.
 *
 * Il taglio e' di due pixel — chiaro sopra, scuro sotto — perche' il fondale
 * scende dal giallo pallido al verde cupo, e una riga di un colore solo
 * sparirebbe in una delle due meta'. Cosi' invece resta incisa ovunque.
 */
function SectionDivider({
  y,
  titolo,
  sottotitolo,
  requiredLevel,
}: {
  /** Centro verticale della fascia, gia' calcolato da buildLayout. */
  y: number;
  /** Il campo su cui si gioca in questa tappa. */
  titolo: string;
  /** "Passi 3 e 4". */
  sottotitolo: string;
  /** Livello che apre la tappa (null se non c'e' un requisito). */
  requiredLevel: number | null;
}) {
  return (
    <div
      className="absolute left-0 right-0 z-[15] pointer-events-none"
      style={{ top: y, transform: 'translateY(-50%)' }}
    >
      <div className="relative flex items-center justify-center px-3">
        <span
          aria-hidden
          className="absolute left-0 right-0"
          style={{
            height: 2,
            background:
              'linear-gradient(to bottom, rgba(255,255,255,0.82), rgba(10,20,14,0.18))',
          }}
        />

        <div
          className="relative flex items-center gap-2 rounded-full max-w-full"
          style={{
            background: 'rgba(255,255,255,0.97)',
            padding: '5px 12px 5px 5px',
            boxShadow: '0 4px 14px rgba(9,16,24,0.22)',
          }}
        >
          <span
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: '#C2C8D2' }}
          >
            <LockIcon size={13} color="#FFFFFF" />
          </span>

          <span className="min-w-0 flex flex-col leading-tight">
            <span
              className="text-[12px] font-bold truncate"
              style={{ color: '#5A6478', fontFamily: 'var(--font-display)' }}
            >
              {titolo}
            </span>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.09em] text-gray-400 truncate">
              {requiredLevel !== null ? `Si apre al livello ${requiredLevel}` : sottotitolo}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Traguardo ──────────────────────────────────────────────────────────────

function Finish({
  state,
  y,
  stepCount,
  g,
}: {
  state: KidsProgramState;
  /** Centro del disco, cioe' dove arriva il sentiero (da buildLayout). */
  y: number;
  stepCount: number;
  g: Geo;
}) {
  const done = state.finished;
  const next = state.nextLevel;
  const passiMancanti = stepCount - state.completedSteps;
  const c = state.program.colors;
  const size = g.finishNode;

  // Due stati, due palette: oro a percorso concluso, colori del percorso
  // finche' il traguardo e' ancora da conquistare.
  const skin = done
    ? {
        disco: 'radial-gradient(circle at 34% 28%, #FFF6D6, #F5B921 74%)',
        bordo: '#E0A611',
        rilievo: '0 7px 0 #C8920F, 0 16px 30px rgba(245,185,33,0.5)',
        inchiostro: '#7A4E05',
        stoffa: '#FFFDF2',
        alone: 'rgba(245,185,33,0.5)',
        titolo: '#8A5B08',
        chipBg: '#FDF3D2',
        chipInk: '#8A5B08',
      }
    : {
        disco: `radial-gradient(circle at 34% 28%, #FFFFFF, ${c.soft} 76%)`,
        bordo: c.accent,
        rilievo: `0 6px 0 ${c.accentDark}, 0 14px 26px rgba(9,16,24,0.34)`,
        inchiostro: c.accentDark,
        stoffa: '#FFFFFF',
        alone: `${c.accent}59`,
        titolo: '#475467',
        chipBg: c.soft,
        chipInk: c.accentDark,
      };

  return (
    <div
      className="absolute z-10"
      style={{
        left: '50%',
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Solo il disco conta per il centraggio: e' il punto esatto in cui
          arriva il sentiero. Alone, anello e targhetta stanno fuori dal flusso
          (absolute), cosi' non spostano il punto d'arrivo. */}
      <div className="relative" style={{ width: size, height: size }}>
        <span
          aria-hidden
          className="absolute rounded-full pointer-events-none adv-glow"
          style={{
            inset: -size * 0.46,
            background: `radial-gradient(circle, ${skin.alone} 0%, transparent 68%)`,
          }}
        />
        {/* Anello che pulsa finche' c'e' ancora strada: e' un invito. A
            percorso concluso sparisce e resta il salterello dell'oro. */}
        {!done && (
          <span
            aria-hidden
            className="adv-pulse-ring absolute rounded-full pointer-events-none"
            style={{ inset: -9, border: `2.5px solid ${c.accent}`, opacity: 0.75 }}
          />
        )}
        <div
          className={`relative w-full h-full rounded-full flex items-center justify-center ${
            done ? 'adv-bob' : ''
          }`}
          style={{
            background: skin.disco,
            border: `2.5px solid ${skin.bordo}`,
            boxShadow: skin.rilievo,
          }}
        >
          <CheckerFlag size={Math.round(size * 0.54)} ink={skin.inchiostro} cloth={skin.stoffa} />
        </div>
      </div>

      {/* Targhetta: due righe corte e mai a capo, cosi' l'altezza e' nota e la
          fascia finale (Geo.finish) le sta sempre attorno senza tagliarla. */}
      <div
        className="absolute left-1/2 top-full mt-3 -translate-x-1/2 px-3.5 py-2 rounded-2xl flex flex-col items-center gap-1"
        style={{ background: 'rgba(255,255,255,0.97)', boxShadow: '0 6px 18px rgba(9,16,24,0.26)' }}
      >
        <span
          className="text-[12.5px] font-bold leading-none whitespace-nowrap"
          style={{ color: skin.titolo, fontFamily: 'var(--font-display)' }}
        >
          {done ? 'Traguardo raggiunto!' : 'Traguardo'}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9.5px] font-extrabold uppercase tracking-[0.06em] whitespace-nowrap"
            style={{ background: skin.chipBg, color: skin.chipInk }}
          >
            Livello {state.maxLevel}
          </span>
          <span className="text-[10.5px] leading-none text-gray-400 whitespace-nowrap">
            {done
              ? next
                ? `poi ${capitalize(next.toLowerCase())}`
                : 'ultimo percorso'
              : passiMancanti === 1
                ? 'ancora 1 passo'
                : `ancora ${passiMancanti} passi`}
          </span>
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

/**
 * Bandiera a scacchi: dice "arrivo" senza bisogno di parole, cosa che un
 * vessillo generico non faceva (si leggeva come una bandierina qualsiasi).
 *
 * La stoffa e' una sola curva ondulata usata due volte: come `clipPath` per
 * ritagliare la scacchiera e come profilo disegnato sopra. Cosi' i quadretti
 * seguono l'onda invece di stare su un rettangolo piatto.
 *
 * `pole` sta a sinistra e la stoffa si sviluppa a destra: l'ingombro e'
 * centrato a occhio nel riquadro 32x32, cosi' dentro al disco tondo non
 * sembra spostata.
 */
function CheckerFlag({ size, ink, cloth }: { size: number; ink: string; cloth: string }) {
  // `useId` evita che due mappe sulla stessa pagina si rubino il ritaglio: gli
  // id SVG sono globali al documento. I due punti vanno tolti, non sono validi
  // dentro `url(#...)`.
  const clip = `kids-flag-${useId().replace(/:/g, '')}`;

  const x0 = 6;
  const y0 = 3.4;
  const w = 21;
  const h = 13.6;
  const cols = 4;
  const rows = 3;
  const cw = w / cols;
  const ch = h / rows;

  const quadretti: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      if ((r + k) % 2 === 1) continue;
      quadretti.push(
        <rect
          key={`${r}-${k}`}
          x={x0 + k * cw}
          y={y0 + r * ch}
          width={cw}
          height={ch}
          fill={ink}
        />
      );
    }
  }

  const stoffa =
    'M6 5 C 10 3.1, 14 7.1, 18 5.5 C 22 3.9, 24.5 5.9, 27 4.5 ' +
    'L 27 15.1 C 24.5 16.5, 22 14.5, 18 16.1 C 14 17.7, 10 13.7, 6 15.7 Z';

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="shrink-0" aria-hidden>
      <defs>
        <clipPath id={clip}>
          <path d={stoffa} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x={x0} y={y0} width={w} height={h} fill={cloth} />
        {quadretti}
      </g>
      <path
        d={stoffa}
        fill="none"
        stroke={ink}
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeOpacity="0.5"
      />
      <path d="M5.6 3.6 V 27.4" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="5.6" cy="2.9" r="1.8" fill={ink} />
    </svg>
  );
}
