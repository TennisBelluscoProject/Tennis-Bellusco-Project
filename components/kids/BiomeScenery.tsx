'use client';

/**
 * ╭──────────────────────────────────────────────────────────────────────╮
 * │  SCENARIO DEI BIOMI — vegetazione e fauna dei bordi della mappa       │
 * ╰──────────────────────────────────────────────────────────────────────╯
 *
 * Disegna quello che sta ai LATI del sentiero dei 12 passi: alghe e coralli
 * per il Delfino, abeti e felci per il Cerbiatto, canne e ninfee per il
 * Coccodrillo. Il fondale (il degrade' continuo) NON sta qui: lo fa
 * `SceneBackground` in KidsPathMap, perche' e' l'unica cosa che deve potersi
 * stirare quando la mappa si accorcia.
 *
 * TRE IDEE, ED E' TUTTO
 *
 * 1. IL CENTRO E' INTOCCABILE.
 *    Tutto vive nelle due fasce laterali larghe `EDGE` (una frazione di vbW).
 *    In mezzo passano sentiero, nodi, soglie ed etichette: se la vegetazione
 *    ci finisce sopra, la mappa smette di leggersi. Gli elementi piu' grandi
 *    stanno anche piu' vicini al bordo (vedi `rientro` degli strati), perche'
 *    sono quelli che sporgono di piu'.
 *
 * 2. TRE STRATI, NON UNO.
 *    Lontano / medio / vicino. Cambiano tre cose insieme — colore (piu' avanti
 *    nella rampa del mondo = piu' scuro), opacita' e scala — ed e' la
 *    combinazione a dare la profondita'. Un solo strato di sagome tutte uguali
 *    sembra carta da parati; tre strati sembrano un bosco.
 *
 * 3. NIENTE E' CASUALE DAVVERO.
 *    Ogni posizione, misura e specie esce da `seeded(i, salt)`: stessa mappa,
 *    stesso disegno a ogni render. Senza, la vegetazione ballerebbe a ogni
 *    spunta dell'allievo.
 *
 * La DENSITA' e la SCELTA DELLE SPECIE crescono con la profondita' `t`: in
 * superficie l'ambiente e' rado e amichevole, in fondo e' fitto e ci sono
 * pinne di squalo, occhi gialli nel folto, coccodrilli a pelo d'acqua.
 *
 * Componente PURAMENTE DECORATIVO: non riceve stato, non ha eventi, e sta
 * dentro un <svg> gia' marcato `aria-hidden`.
 */

import type { ReactNode } from 'react';
import { easeDepth, lerpColor, rampColor, seeded, type WorldConfig } from '@/lib/paths/worlds';
import type { Geo } from '@/lib/kids/map-layout';

// ─── Regole di ingombro ─────────────────────────────────────────────────────

/**
 * Quanto della larghezza puo' occupare UN lato, in frazione di vbW.
 *
 * Il nodo piu' a sinistra sta a `xPattern` = 0.28 e ha mezzo diametro di
 * ingombro, cioe' il suo bordo cade intorno a 0.20. Stando sotto quel valore
 * la vegetazione non gli finisce mai davanti.
 */
const EDGE = 0.185;

interface Strato {
  /** Di quanto si scende nella rampa del mondo rispetto al fondale. */
  spinta: number;
  opacita: number;
  scala: number;
  /** Elementi per fascia e per lato: [in superficie, in profondita']. */
  quantita: [number, number];
  /**
   * LA CORSIA ORIZZONTALE dello strato, in frazione di EDGE: [da bordo, a
   * centro]. Ogni strato ha la sua, e non si sovrappongono quasi mai.
   *
   * Il vicino ha gli elementi piu' grandi, quindi sta a filo di bordo e li
   * lascia sbordare fuori dalla mappa (dove vengono ritagliati, che e' il
   * modo piu' economico di dire "continua oltre"). Il lontano ha gli elementi
   * piu' piccoli e puo' spingersi verso il centro senza dare fastidio.
   */
  corsia: [number, number];
  /**
   * SFASAMENTO VERTICALE, in frazione di casella. Serve perche' i tre strati
   * dividono la stessa fascia in caselle: senza sfasarli, le loro caselle
   * cadrebbero alle stesse altezze e i tre elementi finirebbero incolonnati.
   */
  fase: number;
}

// Il vicino e' UNO SOLO per fascia e per lato: e' quello grande, e mettercene
// due significa per forza accavallarli.
const STRATI: readonly Strato[] = [
  { spinta: 0.12, opacita: 0.4, scala: 0.6, quantita: [2, 3], corsia: [0.3, 1], fase: -0.22 },
  { spinta: 0.26, opacita: 0.66, scala: 0.88, quantita: [1, 2], corsia: [0.12, 0.62], fase: 0 },
  { spinta: 0.44, opacita: 0.92, scala: 1.15, quantita: [1, 1], corsia: [0, 0.3], fase: 0.22 },
];

// ─── Il pennello passato a ogni specie ──────────────────────────────────────

interface Pennello {
  /** Ascissa della base dell'elemento, in unita' del viewBox. */
  x: number;
  /** Ordinata della base: e' da qui che l'elemento "cresce" verso l'alto. */
  y: number;
  /** Scala: 1 ≈ un elemento alto una quarantina di unita'. */
  s: number;
  /** Colore pieno della sagoma. */
  c: string;
  /** Variante chiara, per i rilievi. */
  hi: string;
  /** +1 rivolto verso il centro mappa, -1 verso il bordo. */
  dir: 1 | -1;
  /** Pseudo-casuale deterministico dell'elemento. */
  r: (salt: number) => number;
}

type Specie = (p: Pennello) => ReactNode;

/** Una voce del catalogo di un bioma. */
interface Voce {
  disegna: Specie;
  /** Profondita' minima perche' compaia (0 = fin dalla superficie). */
  da?: number;
  /** Profondita' oltre la quale sparisce. */
  a?: number;
  /** Peso nella scelta: piu' alto = piu' frequente. */
  peso?: number;
}

// ════════════════════════════════════════════════════════════════════════════
//  MARE — mondo Delfino
// ════════════════════════════════════════════════════════════════════════════

/** Alga: un gambo che ondeggia con le foglie alternate sui due lati. */
const Alga: Specie = (p) => {
  const H = 52 * p.s;
  const onda = 10 * p.s * p.dir;
  const foglie: ReactNode[] = [];

  for (let i = 1; i <= 5; i++) {
    const f = i / 6;
    const fx = p.x + onda * Math.sin(f * Math.PI * 1.6) * 0.85;
    const fy = p.y - H * f;
    const L = 15 * p.s * (1 - f * 0.4);
    const lato = i % 2 === 0 ? 1 : -1;
    foglie.push(
      <path
        key={i}
        d={`M ${fx} ${fy} q ${lato * L * 0.9} ${-L * 0.3} ${lato * L} ${-L * 0.95} q ${
          -lato * L * 0.55
        } ${L * 0.25} ${-lato * L} ${L * 0.95} Z`}
        fill={p.c}
      />
    );
  }

  return (
    <>
      {foglie}
      <path
        d={`M ${p.x} ${p.y} C ${p.x + onda} ${p.y - H * 0.34}, ${p.x - onda} ${
          p.y - H * 0.66
        }, ${p.x + onda * 0.5} ${p.y - H}`}
        fill="none"
        stroke={p.c}
        strokeWidth={3 * p.s}
        strokeLinecap="round"
      />
    </>
  );
};

/** Corallo a ventaglio: cinque rami che si aprono dalla stessa base. */
const Corallo: Specie = (p) => {
  const H = 34 * p.s;
  const rami: ReactNode[] = [];
  for (let i = -2; i <= 2; i++) {
    const a = (i / 2) * 0.9;
    rami.push(
      <path
        key={i}
        d={`M ${p.x} ${p.y} Q ${p.x + Math.sin(a) * H * 0.25} ${p.y - H * 0.6} ${
          p.x + Math.sin(a) * H * 0.8
        } ${p.y - Math.cos(a) * H}`}
        fill="none"
        stroke={p.c}
        strokeWidth={3.6 * p.s}
        strokeLinecap="round"
      />
    );
  }
  return <>{rami}</>;
};

/** Scoglio: poligono irregolare con un filo di luce sullo spigolo alto. */
const Scoglio: Specie = (p) => {
  const w = 46 * p.s;
  const h = 24 * p.s;
  const punti = [
    [-0.5, 0],
    [-0.34, -0.6],
    [-0.1, -1],
    [0.16, -0.72],
    [0.42, -0.34],
    [0.5, 0],
  ]
    .map(([a, b]) => `${p.x + a * w},${p.y + b * h}`)
    .join(' ');
  return (
    <>
      <polygon points={punti} fill={p.c} />
      <path
        d={`M ${p.x - w * 0.1} ${p.y - h} L ${p.x + w * 0.16} ${p.y - h * 0.72}`}
        stroke={p.hi}
        strokeWidth={1.6 * p.s}
        strokeLinecap="round"
        opacity={0.45}
      />
    </>
  );
};

/** Colonna di bolle che risale. */
const Bolle: Specie = (p) => {
  const out: ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    out.push(
      <circle
        key={i}
        cx={p.x + (p.r(i + 1) - 0.5) * 14 * p.s}
        cy={p.y - i * 11 * p.s - p.r(i + 9) * 6 * p.s}
        r={(1.6 + p.r(i + 17) * 2.4) * p.s}
        fill="#FFFFFF"
        opacity={0.5}
      />
    );
  }
  return <>{out}</>;
};

/** Banco di pesciolini: corpo a mandorla piu' coda a cuneo. */
const Pesci: Specie = (p) => {
  const out: ReactNode[] = [];
  for (let i = 0; i < 4; i++) {
    const fx = p.x + (p.r(i + 3) - 0.5) * 30 * p.s;
    const fy = p.y - 8 * p.s - p.r(i + 13) * 34 * p.s;
    const L = (5 + p.r(i + 23) * 3) * p.s * p.dir;
    out.push(
      <path
        key={i}
        d={
          `M ${fx} ${fy} q ${L} ${-L * 0.42} ${L * 2} 0 q ${-L} ${L * 0.42} ${-L * 2} 0 Z ` +
          `M ${fx} ${fy} l ${-L * 0.7} ${-L * 0.5} l 0 ${L} Z`
        }
        fill={p.c}
      />
    );
  }
  return <>{out}</>;
};

/** Medusa: cupola e tentacoli. Galleggia, quindi non poggia su niente. */
const Medusa: Specie = (p) => {
  const R = 11 * p.s;
  const tentacoli: ReactNode[] = [];
  for (let i = -2; i <= 2; i++) {
    const tx = p.x + i * R * 0.38;
    tentacoli.push(
      <path
        key={i}
        d={`M ${tx} ${p.y - R * 0.1} q ${R * 0.3} ${R * 0.9} ${
          i % 2 === 0 ? R * 0.15 : -R * 0.15
        } ${R * 1.9}`}
        fill="none"
        stroke={p.c}
        strokeWidth={1.5 * p.s}
        strokeLinecap="round"
        opacity={0.7}
      />
    );
  }
  return (
    <>
      <path d={`M ${p.x - R} ${p.y} a ${R} ${R * 0.95} 0 0 1 ${R * 2} 0 Z`} fill={p.c} />
      {tentacoli}
    </>
  );
};

/** Pinna di squalo: compare solo nelle acque profonde. */
const Pinna: Specie = (p) => {
  const S = 13 * p.s;
  return (
    <path
      d={`M ${p.x - S * 0.75} ${p.y} Q ${p.x} ${p.y - S * 1.5} ${p.x + S * 0.3} ${p.y} Z`}
      fill={p.c}
    />
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  BOSCO — mondo Cerbiatto
// ════════════════════════════════════════════════════════════════════════════

/** Abete: tre falde sovrapposte, non un triangolo solo. */
const Abete: Specie = (p) => {
  const H = 62 * p.s;
  const W = 26 * p.s;
  const falde: ReactNode[] = [];
  for (let i = 0; i < 3; i++) {
    const base = p.y - H * 0.05 - H * 0.16 * i;
    const cima = p.y - H * (0.42 + i * 0.29);
    const w = W * (1 - i * 0.22);
    falde.push(
      <polygon
        key={i}
        points={`${p.x - w / 2},${base} ${p.x},${cima} ${p.x + w / 2},${base}`}
        fill={p.c}
      />
    );
  }
  return (
    <>
      <rect x={p.x - 1.8 * p.s} y={p.y - H * 0.13} width={3.6 * p.s} height={H * 0.15} fill={p.c} />
      {falde}
    </>
  );
};

/** Latifoglia: tronco affusolato e chioma fatta di tre masse. */
const Latifoglia: Specie = (p) => {
  const H = 54 * p.s;
  const R = 17 * p.s;
  const cy = p.y - H + R * 0.6;
  return (
    <>
      <path
        d={`M ${p.x - 2.4 * p.s} ${p.y} L ${p.x - 1.4 * p.s} ${p.y - H * 0.62} L ${
          p.x + 1.4 * p.s
        } ${p.y - H * 0.62} L ${p.x + 2.4 * p.s} ${p.y} Z`}
        fill={p.c}
      />
      <circle cx={p.x - R * 0.55} cy={cy + R * 0.3} r={R * 0.72} fill={p.c} />
      <circle cx={p.x + R * 0.5} cy={cy + R * 0.36} r={R * 0.66} fill={p.c} />
      <circle cx={p.x} cy={cy - R * 0.2} r={R * 0.86} fill={p.c} />
    </>
  );
};

/** Felce: cinque fronde che si aprono a raggiera dal suolo. */
const Felce: Specie = (p) => {
  const H = 24 * p.s;
  const fronde: ReactNode[] = [];
  for (let i = -2; i <= 2; i++) {
    const a = (i / 2) * 1.05;
    fronde.push(
      <path
        key={i}
        d={`M ${p.x} ${p.y} Q ${p.x + Math.sin(a) * H * 0.5} ${p.y - H * 0.95} ${
          p.x + Math.sin(a) * H * 1.15
        } ${p.y - Math.cos(a) * H * 0.75}`}
        fill="none"
        stroke={p.c}
        strokeWidth={2.6 * p.s}
        strokeLinecap="round"
      />
    );
  }
  return <>{fronde}</>;
};

/** Fungo del sottobosco: una delle poche macchie di colore vivo. */
const Fungo: Specie = (p) => {
  const H = 13 * p.s;
  return (
    <>
      <rect
        x={p.x - 1.6 * p.s}
        y={p.y - H * 0.62}
        width={3.2 * p.s}
        height={H * 0.62}
        rx={1.4 * p.s}
        fill={p.hi}
      />
      <path
        d={`M ${p.x - H * 0.62} ${p.y - H * 0.58} a ${H * 0.62} ${H * 0.55} 0 0 1 ${H * 1.24} 0 Z`}
        fill="#C0392B"
      />
      <circle cx={p.x - H * 0.2} cy={p.y - H * 0.8} r={H * 0.11} fill="#FFF3E0" opacity={0.85} />
      <circle cx={p.x + H * 0.24} cy={p.y - H * 0.72} r={H * 0.09} fill="#FFF3E0" opacity={0.85} />
    </>
  );
};

/** Lucciole: puntino caldo dentro un alone, sparse in verticale. */
const Lucciole: Specie = (p) => {
  const out: ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    const fx = p.x + (p.r(i + 2) - 0.5) * 40 * p.s;
    const fy = p.y - p.r(i + 12) * 46 * p.s;
    out.push(
      <g key={i}>
        <circle cx={fx} cy={fy} r={3.6 * p.s} fill="#FDE68A" opacity={0.2} />
        <circle cx={fx} cy={fy} r={1.25 * p.s} fill="#FDE68A" />
      </g>
    );
  }
  return <>{out}</>;
};

/** Due occhi gialli nel folto: si accendono solo dove il bosco e' buio. */
const OcchiNelFolto: Specie = (p) => (
  <>
    <ellipse cx={p.x - 3.6 * p.s} cy={p.y} rx={1.8 * p.s} ry={1.3 * p.s} fill="#FCD34D" />
    <ellipse cx={p.x + 3.6 * p.s} cy={p.y} rx={1.8 * p.s} ry={1.3 * p.s} fill="#FCD34D" />
  </>
);

// ════════════════════════════════════════════════════════════════════════════
//  PALUDE — mondo Coccodrillo
//
//  La regola qui e' diversa dagli altri due biomi: SAGOME PIENE, pochi tratti.
//  La prima versione era fatta di canne sottili, archi di radici e liane
//  pendenti — tutti segni di una o due unita' di spessore — e messi insieme
//  davano un groviglio invece di una palude. Adesso il peso lo portano le
//  masse piene (fronde, chiome, foglie di ninfea) e i tratti sottili restano
//  solo dove servono a fare contrasto.
//
//  E si deve leggere come ACQUA FERMA, non come prato scuro: da qui la tacca
//  vera della ninfea, le increspature concentriche e la lenticchia a galla.
// ════════════════════════════════════════════════════════════════════════════

/** Punto su un'ellisse a un dato angolo. Serve alla tacca della ninfea. */
function suEllisse(cx: number, cy: number, rx: number, ry: number, a: number): string {
  return `${cx + rx * Math.cos(a)} ${cy + ry * Math.sin(a)}`;
}

/**
 * Ninfea: la foglia tonda con la TACCA a cuneo, non un'ellisse liscia.
 *
 * La tacca e' quello che la rende riconoscibile a colpo d'occhio come ninfea
 * invece che come sasso o pozza. E' fatta con UN SOLO arco: dal centro al
 * bordo, giro lungo dell'ellisse (large-arc), ritorno al centro. Cosi' non
 * serve ritagliare niente col colore del fondale, che qui non si potrebbe
 * fare visto che il fondale e' un degrade' continuo.
 */
const Ninfea: Specie = (p) => {
  const R = 17 * p.s;
  const ry = R * 0.42;
  const mezzoCuneo = 0.34;
  // Il cuneo guarda verso il centro mappa, dove il fondale e' piu' chiaro e
  // quindi lo stacco si vede.
  const verso = p.dir === 1 ? 0 : Math.PI;

  return (
    <>
      <path
        d={
          `M ${p.x} ${p.y} L ${suEllisse(p.x, p.y, R, ry, verso + mezzoCuneo)} ` +
          `A ${R} ${ry} 0 1 1 ${suEllisse(p.x, p.y, R, ry, verso - mezzoCuneo)} Z`
        }
        fill={p.c}
      />
      {[-0.9, 0, 0.9].map((d, i) => (
        <path
          key={i}
          d={`M ${p.x} ${p.y} L ${suEllisse(p.x, p.y, R * 0.8, ry * 0.8, verso + Math.PI + d)}`}
          stroke={p.hi}
          strokeWidth={0.9 * p.s}
          opacity={0.28}
        />
      ))}
    </>
  );
};

/** Fiore di loto: petali a raggiera e cuore dorato. La nota di colore. */
const Loto: Specie = (p) => {
  const R = 11 * p.s;
  const petali: ReactNode[] = [];

  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.42;
    const cx = p.x + Math.cos(a) * R * 0.46;
    const cy = p.y - R * 0.2 + Math.sin(a) * R * 0.46;
    petali.push(
      <ellipse
        key={i}
        cx={cx}
        cy={cy}
        rx={R * 0.5}
        ry={R * 0.21}
        fill={i % 2 === 0 ? '#F6C4D8' : '#FCE6EF'}
        transform={`rotate(${(a * 180) / Math.PI} ${cx} ${cy})`}
      />
    );
  }

  return (
    <>
      <ellipse cx={p.x} cy={p.y + R * 0.14} rx={R} ry={R * 0.32} fill={p.c} />
      {petali}
      <circle cx={p.x} cy={p.y - R * 0.2} r={R * 0.2} fill="#F7C948" />
    </>
  );
};

/**
 * Palma di palude: cinque fronde piene aperte da un fusto corto.
 *
 * Ogni fronda e' una LENTE — due curve che si richiudono — e non una linea:
 * e' questo che da' massa alla palude senza affollarla di segni sottili.
 */
const Palma: Specie = (p) => {
  const H = 44 * p.s;
  const fronde: ReactNode[] = [];

  for (let i = -2; i <= 2; i++) {
    const a = -Math.PI / 2 + (i / 2) * 1.05;
    const bx = p.x;
    const by = p.y - H * 0.28;
    const tx = bx + Math.cos(a) * H;
    const ty = by + Math.sin(a) * H;
    // Normale alla fronda: e' lo spessore della lente.
    const nx = -Math.sin(a) * H * 0.17;
    const ny = Math.cos(a) * H * 0.17;
    fronde.push(
      <path
        key={i}
        d={
          `M ${bx} ${by} Q ${(bx + tx) / 2 + nx} ${(by + ty) / 2 + ny} ${tx} ${ty} ` +
          `Q ${(bx + tx) / 2 - nx} ${(by + ty) / 2 - ny} ${bx} ${by} Z`
        }
        fill={p.c}
      />
    );
  }

  return (
    <>
      <path
        d={`M ${p.x - 2.6 * p.s} ${p.y} L ${p.x - 1.5 * p.s} ${p.y - H * 0.3} L ${
          p.x + 1.5 * p.s
        } ${p.y - H * 0.3} L ${p.x + 2.6 * p.s} ${p.y} Z`}
        fill={p.c}
      />
      {fronde}
    </>
  );
};

/**
 * Cipresso di palude: piede svasato (cresce nell'acqua, quindi si allarga sul
 * pelo), chioma in due masse sfalsate e barbe di muschio che pendono.
 */
const Cipresso: Specie = (p) => {
  const H = 58 * p.s;
  const W = 22 * p.s;
  const barbe: ReactNode[] = [];

  for (let i = 0; i < 3; i++) {
    const bx = p.x + (i - 1) * W * 0.34;
    const by = p.y - H * (0.5 + p.r(i + 5) * 0.16);
    const L = (10 + p.r(i + 15) * 12) * p.s;
    barbe.push(
      <path
        key={i}
        d={`M ${bx} ${by} q ${2 * p.s} ${L * 0.6} ${-1.5 * p.s} ${L}`}
        fill="none"
        stroke={p.c}
        strokeWidth={1.6 * p.s}
        strokeLinecap="round"
        opacity={0.6}
      />
    );
  }

  return (
    <>
      <path
        d={`M ${p.x - W * 0.34} ${p.y} Q ${p.x - W * 0.12} ${p.y - H * 0.3} ${
          p.x - W * 0.09
        } ${p.y - H * 0.62} L ${p.x + W * 0.09} ${p.y - H * 0.62} Q ${p.x + W * 0.12} ${
          p.y - H * 0.3
        } ${p.x + W * 0.34} ${p.y} Z`}
        fill={p.c}
      />
      <ellipse cx={p.x - W * 0.2} cy={p.y - H * 0.72} rx={W * 0.54} ry={W * 0.4} fill={p.c} />
      <ellipse cx={p.x + W * 0.16} cy={p.y - H * 0.85} rx={W * 0.62} ry={W * 0.46} fill={p.c} />
      {barbe}
    </>
  );
};

/** Canneto: pochi steli, spessi, in ciuffo stretto. Alcuni con la tifa. */
const Canneto: Specie = (p) => {
  const out: ReactNode[] = [];

  for (let i = 0; i < 4; i++) {
    const cx = p.x + (i - 1.5) * 6.5 * p.s;
    const H = (28 + p.r(i + 11) * 22) * p.s;
    const cima = cx + (p.r(i + 21) - 0.5) * 6 * p.s;
    out.push(
      <path
        key={`s${i}`}
        d={`M ${cx} ${p.y} Q ${cx} ${p.y - H * 0.6} ${cima} ${p.y - H}`}
        fill="none"
        stroke={p.c}
        strokeWidth={2.6 * p.s}
        strokeLinecap="round"
      />
    );
    if (p.r(i + 31) > 0.4) {
      out.push(
        <rect
          key={`t${i}`}
          x={cima - 2.3 * p.s}
          y={p.y - H - 1.5 * p.s}
          width={4.6 * p.s}
          height={11 * p.s}
          rx={2.3 * p.s}
          fill={p.c}
        />
      );
    }
  }

  return <>{out}</>;
};

/**
 * Pelo d'acqua: increspature concentriche piu' una spolverata di lenticchia.
 *
 * E' la cosa che piu' di ogni altra dice "qui sotto c'e' acqua ferma".
 * Mancava del tutto nella prima versione, ed e' il motivo per cui la palude
 * sembrava un prato scuro invece di uno stagno.
 */
const PeloDacqua: Specie = (p) => {
  const R = 20 * p.s;
  const lenticchie: ReactNode[] = [];

  for (let i = 0; i < 9; i++) {
    lenticchie.push(
      <ellipse
        key={i}
        cx={p.x + (p.r(i + 1) - 0.5) * R * 2.4}
        cy={p.y + (p.r(i + 11) - 0.5) * R * 0.7}
        rx={1.5 * p.s}
        ry={0.9 * p.s}
        fill={p.hi}
        opacity={0.45}
      />
    );
  }

  return (
    <>
      {[1, 0.66, 0.36].map((k, i) => (
        <ellipse
          key={i}
          cx={p.x}
          cy={p.y}
          rx={R * k}
          ry={R * k * 0.3}
          fill="none"
          stroke={p.hi}
          strokeWidth={0.9 * p.s}
          opacity={0.2}
        />
      ))}
      {lenticchie}
    </>
  );
};

/** Libellula: quattro ali lunghe e sfalsate, non due paia sovrapposte. */
const Libellula: Specie = (p) => {
  const L = 13 * p.s;
  const ali: readonly (readonly [number, number, number])[] = [
    [-0.22, -0.26, -18],
    [0.22, -0.26, 18],
    [-0.3, 0.18, -8],
    [0.3, 0.18, 8],
  ];

  return (
    <>
      {ali.map(([dx, dy, rot], i) => {
        const cx = p.x + L * dx;
        const cy = p.y + L * dy;
        return (
          <ellipse
            key={i}
            cx={cx}
            cy={cy}
            rx={L * 0.44}
            ry={L * 0.11}
            fill="#CDEBF7"
            opacity={i < 2 ? 0.7 : 0.5}
            transform={`rotate(${rot} ${cx} ${cy})`}
          />
        );
      })}
      <rect
        x={p.x - L * 0.5}
        y={p.y - L * 0.07}
        width={L}
        height={L * 0.14}
        rx={L * 0.07}
        fill={p.c}
      />
      <circle cx={p.x - L * 0.5} cy={p.y} r={L * 0.13} fill={p.c} />
    </>
  );
};

/** Il coccodrillo a pelo d'acqua: dorso, occhi e le onde che si allargano. */
const OcchiSullAcqua: Specie = (p) => (
  <>
    {[1, 0.6].map((k, i) => (
      <ellipse
        key={i}
        cx={p.x}
        cy={p.y + 2 * p.s}
        rx={22 * p.s * k}
        ry={5 * p.s * k}
        fill="none"
        stroke={p.hi}
        strokeWidth={0.9 * p.s}
        opacity={0.22}
      />
    ))}
    <ellipse cx={p.x} cy={p.y + 2.2 * p.s} rx={14 * p.s} ry={2.6 * p.s} fill={p.c} />
    <ellipse cx={p.x - 4.2 * p.s} cy={p.y} rx={2.3 * p.s} ry={2 * p.s} fill={p.c} />
    <ellipse cx={p.x + 4.2 * p.s} cy={p.y} rx={2.3 * p.s} ry={2 * p.s} fill={p.c} />
    <circle cx={p.x - 4.2 * p.s} cy={p.y - 0.3 * p.s} r={1.5 * p.s} fill="#F7C948" />
    <circle cx={p.x + 4.2 * p.s} cy={p.y - 0.3 * p.s} r={1.5 * p.s} fill="#F7C948" />
    <ellipse cx={p.x - 4.2 * p.s} cy={p.y - 0.3 * p.s} rx={0.5 * p.s} ry={1.3 * p.s} fill="#14231A" />
    <ellipse cx={p.x + 4.2 * p.s} cy={p.y - 0.3 * p.s} rx={0.5 * p.s} ry={1.3 * p.s} fill="#14231A" />
  </>
);

// ─── Catalogo per bioma ─────────────────────────────────────────────────────
//
// `da` e' quello che rende l'ambiente ostile scendendo: la pinna di squalo,
// gli occhi nel folto e il coccodrillo non esistono in superficie, arrivano
// solo dove il fondale e' gia' scuro.

const CATALOGO: Record<string, readonly Voce[]> = {
  delfino: [
    { disegna: Alga, peso: 3 },
    { disegna: Corallo, peso: 2 },
    { disegna: Scoglio, peso: 2 },
    { disegna: Bolle, peso: 2, a: 0.82 },
    { disegna: Pesci, peso: 2, da: 0.22 },
    { disegna: Medusa, peso: 1.6, da: 0.5 },
    { disegna: Pinna, peso: 1.2, da: 0.68 },
  ],
  cerbiatto: [
    { disegna: Abete, peso: 3 },
    { disegna: Latifoglia, peso: 2.4 },
    { disegna: Felce, peso: 2 },
    { disegna: Fungo, peso: 1.2, a: 0.8 },
    { disegna: Lucciole, peso: 1.8, da: 0.38 },
    { disegna: OcchiNelFolto, peso: 1, da: 0.7 },
  ],
  // Palude: le masse piene (ninfea, palma, cipresso) pesano piu' dei tratti
  // sottili, altrimenti si torna al groviglio di canne della prima versione.
  coccodrillo: [
    { disegna: Ninfea, peso: 3 },
    { disegna: Palma, peso: 2.4 },
    { disegna: Cipresso, peso: 2.2 },
    { disegna: Canneto, peso: 1.8 },
    { disegna: PeloDacqua, peso: 1.6 },
    { disegna: Loto, peso: 1.3, a: 0.72 },
    { disegna: Libellula, peso: 1.1, a: 0.66 },
    { disegna: OcchiSullAcqua, peso: 1.4, da: 0.5 },
  ],
};

/** Estrae una specie ammessa a profondita' `t`, con i pesi del catalogo. */
function scegli(voci: readonly Voce[], t: number, r: number): Specie {
  const ammesse = voci.filter((v) => t >= (v.da ?? 0) && t <= (v.a ?? 1));
  const lista = ammesse.length > 0 ? ammesse : voci;
  const totale = lista.reduce((n, v) => n + (v.peso ?? 1), 0);
  let acc = r * totale;
  for (const v of lista) {
    acc -= v.peso ?? 1;
    if (acc <= 0) return v.disegna;
  }
  return lista[lista.length - 1].disegna;
}

// ─── Il profilo continuo dei due bordi ──────────────────────────────────────

/**
 * La massa lontana: una spezzata verticale che ondeggia lungo tutto il bordo.
 *
 * Serve ad ANCORARE gli elementi sparsi. Senza, le sagome galleggiano nel
 * vuoto e la mappa sembra un fondale con degli adesivi sopra; con questa
 * dietro, sembrano affacciarsi da qualcosa.
 */
function Profilo({
  lato,
  totalH,
  vbW,
  fill,
}: {
  lato: 1 | -1;
  totalH: number;
  vbW: number;
  fill: string;
}) {
  const passo = 48;
  const n = Math.max(2, Math.ceil(totalH / passo));
  const sale = lato === 1 ? 71 : 97;
  const punti: string[] = [];

  for (let i = 0; i <= n; i++) {
    const y = Math.min(totalH, i * passo);
    const w = (0.05 + seeded(i, sale) * 0.08) * vbW;
    punti.push(`${lato === 1 ? w : vbW - w},${y}`);
  }

  const ancora = lato === 1 ? 0 : vbW;
  return (
    <path d={`M ${ancora},0 L ${punti.join(' L ')} L ${ancora},${totalH} Z`} fill={fill} opacity={0.5} />
  );
}

// ─── Il componente ──────────────────────────────────────────────────────────

export function EdgeDecor({ world, totalH, g }: { world: WorldConfig; totalH: number; g: Geo }) {
  const voci = CATALOGO[world.id] ?? CATALOGO.delfino;
  const fasce = Math.max(1, Math.ceil(totalH / g.band));
  const uid = `biome-${world.id}`;

  /**
   * Il colore della sagoma a profondita' `t`, spinto avanti nella rampa del
   * mondo e appena virato al verde-nero. Campionare dalla STESSA rampa del
   * fondale e' quello che tiene insieme la tavolozza: la vegetazione non e'
   * mai un colore estraneo, e' sempre lo stesso ambiente piu' fitto.
   */
  const tinta = (t: number, spinta: number) =>
    lerpColor(rampColor(world.gradient, Math.min(1, t + spinta)), '#08130C', 0.14);

  // Il profilo attraversa tutta l'altezza, quindi non puo' avere UN colore:
  // in cima sarebbe una macchia scura sul chiaro, in fondo sparirebbe. Segue
  // la rampa come il fondale, solo un gradino piu' sotto.
  const CAMPIONI = 8;
  const stopsProfilo = Array.from({ length: CAMPIONI + 1 }, (_, k) => {
    const p = k / CAMPIONI;
    return { off: ((p * 100).toFixed(1)), col: tinta(easeDepth(p), 0.16) };
  });

  const elementi: ReactNode[] = [];

  for (let s = 0; s < STRATI.length; s++) {
    const strato = STRATI[s];

    for (let b = 0; b < fasce; b++) {
      const t = easeDepth(fasce <= 1 ? 0 : b / (fasce - 1));
      const y0 = b * g.band;
      const h = Math.min(g.band, totalH - y0);
      if (h <= 0) break;

      const c = tinta(t, strato.spinta);
      const hi = lerpColor(c, '#FFFFFF', 0.3);
      const quanti = Math.round(
        strato.quantita[0] + (strato.quantita[1] - strato.quantita[0]) * t
      );

      for (const lato of [1, -1] as const) {
        // La fascia si divide in tante CASELLE quanti sono gli elementi, e
        // ognuno sta nella sua. E' questo — non il caso — a garantire che due
        // elementi dello stesso strato non finiscano mai uno sull'altro, e
        // che nessuno sbordi nella fascia sotto.
        const casella = h / quanti;

        for (let k = 0; k < quanti; k++) {
          // Seme: strato, fascia, lato e indice. Cambiando uno solo di questi
          // cambia tutto l'elemento, ma per una data mappa resta identico.
          const seme = s * 911 + b * 37 + (lato === 1 ? 0 : 13) + k * 5;
          const r = (salt: number) => seeded(seme, salt);

          // Dentro la casella c'e' un margine di gioco del 36%: abbastanza da
          // rompere l'allineamento, non tanto da far toccare le caselle.
          const y = y0 + casella * (k + 0.5 + strato.fase) + (r(23) - 0.5) * casella * 0.36;

          const [daBordo, aCentro] = strato.corsia;
          const rientro = (daBordo + r(11) * (aCentro - daBordo)) * EDGE * g.vbW;
          const x = lato === 1 ? rientro : g.vbW - rientro;

          const scala = strato.scala * (0.78 + r(31) * 0.44) * (1 + t * 0.16);

          const disegna = scegli(voci, t, r(43));
          elementi.push(
            <g key={`${s}-${b}-${lato}-${k}`} opacity={strato.opacita}>
              {disegna({ x, y, s: scala, c, hi, dir: lato, r })}
            </g>
          );
        }
      }
    }
  }

  return (
    <>
      <defs>
        <linearGradient id={`${uid}-profilo`} x1="0" y1="0" x2="0" y2="1">
          {stopsProfilo.map((s, k) => (
            <stop key={k} offset={`${s.off}%`} stopColor={s.col} />
          ))}
        </linearGradient>
      </defs>
      <Profilo lato={1} totalH={totalH} vbW={g.vbW} fill={`url(#${uid}-profilo)`} />
      <Profilo lato={-1} totalH={totalH} vbW={g.vbW} fill={`url(#${uid}-profilo)`} />
      {elementi}
    </>
  );
}
