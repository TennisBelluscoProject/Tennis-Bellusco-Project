/**
 * ╭──────────────────────────────────────────────────────────────────────╮
 * │  PERCORSI KIDS — GEOMETRIA DELLA MAPPA (funzioni pure)                │
 * ╰──────────────────────────────────────────────────────────────────────╯
 *
 * Dove stanno, sulla mappa dei 12 passi, i nodi, i divisori di sezione, il
 * traguardo e la curva che li unisce. Niente React, niente DOM: solo numeri.
 * Cosi' le regole di non sovrapposizione si verificano con un test invece che
 * con uno screenshot.
 *
 * TRE IDEE, ED E' TUTTO
 *
 * 1. LA VERTICALE SI IMPILA.
 *    Le y non sono `indice * altezza`. Ogni riga (un passo, un divisore di
 *    sezione, il traguardo) dichiara la propria altezza e `buildLayout` le
 *    mette una sotto l'altra. Il divisore ha quindi una FASCIA TUTTA SUA e non
 *    puo' finire addosso ai passi vicini.
 *
 * 2. IL RITMO E' IRREGOLARE, DI PROPOSITO.
 *    Un sentiero in cui ogni passo sta esattamente a destra, poi esattamente a
 *    sinistra, sempre alla stessa distanza, non sembra un sentiero: sembra una
 *    tabella. `xPattern` ha SETTE posizioni di ampiezza diversa e `bandPattern`
 *    CINQUE altezze diverse: essendo lunghezze prime fra loro e primi rispetto
 *    a 12, la combinazione non si ripete mai lungo il percorso.
 *
 * 3. LE SEZIONI SONO L'UNITA' DI LETTURA.
 *    I 12 passi sono 6 TAPPE da 2. Il titolo sta sulla tappa, non sul singolo
 *    passo (il nodo dice gia' tutto: numero, quanti obiettivi, se e' fatto), e
 *    il divisore che apre la tappa e' anche quello che dice se e' chiusa a
 *    chiave. Un elemento solo per due mestieri.
 */

// ─── Il formato ─────────────────────────────────────────────────────────────

export interface Geo {
  /** Larghezza logica del viewBox dello scenario. */
  vbW: number;
  /** Altezza di riferimento della riga di un passo. */
  band: number;
  /**
   * Moltiplicatori dell'altezza, applicati a rotazione ai passi: danno al
   * sentiero un respiro irregolare invece del passo di marcia.
   */
  bandPattern: readonly number[];
  /** Altezza della fascia che apre una sezione (tappa). */
  sectionBand: number;
  /** Cielo libero sopra la prima sezione: e' li' che sta il sole. */
  topPad: number;
  /** Altezza della fascia finale con il traguardo. */
  finish: number;
  node: number;
  nodeCurrent: number;
  /** Mascotte nella testata. */
  headerMascot: number;
  /** Dimensione della mascotte che cammina sul sentiero. */
  mascot: number;
  /** Distanza orizzontale (unita' del viewBox) fra mascotte e nodo. */
  mascotOffset: number;
  /** Mascotte dal lato ESTERNO del nodo (verso il bordo) invece che interno. */
  mascotOuter: boolean;
  /** Frazioni orizzontali del sentiero, applicate a rotazione. */
  xPattern: readonly number[];
  /** Larghezza massima della mappa (serve solo fuori dal full-bleed). */
  maxW?: number;
}

const RITMO = [1, 0.9, 1.14, 0.96, 1.06] as const;

export const GEO_MOBILE: Geo = {
  vbW: 390,
  band: 112,
  bandPattern: RITMO,
  sectionBand: 68,
  topPad: 14,
  finish: 150,
  node: 62,
  nodeCurrent: 72,
  headerMascot: 92,
  mascot: 60,
  mascotOffset: 78,
  mascotOuter: false,
  // Sette ampiezze diverse: il sentiero ondeggia invece di rimbalzare fra due
  // sponde. Nessuna coppia consecutiva e' troppo vicina, altrimenti i due nodi
  // sembrerebbero incolonnati.
  xPattern: [0.28, 0.66, 0.42, 0.74, 0.34, 0.6, 0.46],
};

export const GEO_DESKTOP: Geo = {
  vbW: 780,
  band: 168,
  bandPattern: RITMO,
  sectionBand: 78,
  topPad: 10,
  finish: 200,
  node: 84,
  nodeCurrent: 96,
  headerMascot: 116,
  mascot: 108,
  mascotOffset: 132,
  mascotOuter: false,
  xPattern: [0.3, 0.66, 0.44, 0.72, 0.36, 0.62, 0.48],
};

/** Ascissa del nodo i-esimo, in unita' del viewBox. */
export const xFor = (i: number, g: Geo): number =>
  g.xPattern[i % g.xPattern.length] * g.vbW;

/** Altezza della riga del passo i-esimo. */
export const bandFor = (i: number, g: Geo): number =>
  g.band * g.bandPattern[i % g.bandPattern.length];

// ─── Impilamento verticale ──────────────────────────────────────────────────

/** Il minimo che serve sapere di un passo per collocarlo. */
export interface LayoutStep {
  /** true sul PRIMO passo di ogni tappa: sopra di lui va il divisore. */
  startsSection: boolean;
}

export interface MapLayout {
  /** Centro verticale di ogni passo. */
  stepY: number[];
  /**
   * Centro del divisore che APRE la sezione, indicizzato per passo: valorizzato
   * solo sul primo passo di ogni tappa, null sugli altri.
   */
  sectionY: (number | null)[];
  finishY: number;
  totalH: number;
}

/**
 * Impila le righe e restituisce le y. Unica fonte di verita' della verticale:
 * scenario, sentiero, nodi, divisori e traguardo leggono tutti da qui.
 */
export function buildLayout(steps: readonly LayoutStep[], g: Geo): MapLayout {
  const stepY: number[] = [];
  const sectionY: (number | null)[] = [];
  let y = g.topPad;

  steps.forEach((s, i) => {
    if (s.startsSection) {
      sectionY.push(y + g.sectionBand / 2);
      y += g.sectionBand;
    } else {
      sectionY.push(null);
    }

    const h = bandFor(i, g);
    stepY.push(y + h / 2);
    y += h;
  });

  return { stepY, sectionY, finishY: y + g.finish / 2, totalH: y + g.finish };
}

// ─── Il sentiero come curva percorribile ────────────────────────────────────
//
// La stessa curva serve a DUE cose: disegnare il tracciato nello scenario e
// far CAMMINARE la mascotte sopra. Quindi la geometria si calcola una volta
// sola qui e viene usata da entrambi.
//
// I nodi sono i punti di passaggio; i punti di controllo vengono da
// Catmull-Rom, cosi' le giunzioni fra un tratto e il successivo non hanno
// spigoli. `pointAt` prende una posizione GLOBALE lungo il sentiero: 0 e' il
// primo passo, 1 il secondo, ... N il traguardo. La parte intera dice su
// quale tratto siamo, la parte decimale dove.

export type Point = [number, number];

export interface TrailSegment {
  p1: Point;
  p2: Point;
  c1: Point;
  c2: Point;
  /** Punto del tratto a t ∈ [0,1]. */
  at: (t: number) => Point;
}

export interface Trail {
  segments: TrailSegment[];
  /** Punto a una posizione globale ∈ [0, segments.length]. */
  pointAt: (position: number) => Point;
}

/** Tensione della Catmull-Rom: piu' alta = curve piu' ampie. */
const TRAIL_TENSION = 0.34;

export function buildTrail(layout: MapLayout, g: Geo): Trail {
  const pts: Point[] = layout.stepY.map((y, i) => [xFor(i, g), y] as Point);
  pts.push([g.vbW / 2, layout.finishY]); // traguardo

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
    if (segments.length === 0) return [g.vbW / 2, layout.stepY[0] ?? 0];
    const clamped = Math.max(0, Math.min(segments.length, position));
    if (clamped >= segments.length) return segments[segments.length - 1].p2;
    const i = Math.floor(clamped);
    return segments[i].at(clamped - i);
  };

  return { segments, pointAt };
}
