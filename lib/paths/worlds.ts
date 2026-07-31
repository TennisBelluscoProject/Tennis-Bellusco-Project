/**
 * ╭──────────────────────────────────────────────────────────────────────╮
 * │  MONDI DEL PERCORSO — configurazione estetica per livello             │
 * ╰──────────────────────────────────────────────────────────────────────╯
 *
 * Ogni livello del club (DELFINO / CERBIATTO / COCCODRILLO) e' un "mondo"
 * con il proprio scenario. Lo scenario evolve da "calmo" (prime tappe) a
 * "selvaggio" (ultime tappe): i colori vengono interpolati con `lerpColor`
 * in base alla posizione della tappa nel percorso.
 *
 * PRINCIPIO DEI TRE LIVELLI (avatar): la mascotte di ogni mondo ha 3 stadi
 * evolutivi — Cucciolo → Ragazzo → Adulto — determinati dalla percentuale
 * di tappe completate (vedi `tierForCompletion`).
 *
 * IMMAGINI: le grafiche sono in `public/percorsi/<mondo>/<tier>.png` e sono
 * collegate qui sotto tramite il campo `image` di ogni tier. Se un file
 * mancasse basta togliere la riga `image`: il componente torna in automatico
 * al placeholder (emoji + piastra). Vedi public/percorsi/README.md.
 * ATTENZIONE: i nomi dei file sono case-sensitive in produzione (Linux/Vercel),
 * quindi vanno tenuti tutti minuscoli.
 *
 * File PURO (nessun React, nessun Supabase): solo dati e piccole funzioni.
 */

import type { PlayerLevel } from '@/lib/database.types';

// ─── Tipi ───────────────────────────────────────────────────────────────────

export type MascotTierId = 'cucciolo' | 'ragazzo' | 'adulto';

export interface MascotTier {
  id: MascotTierId;
  /** Etichetta mostrata sotto l'avatar (es. "Cucciolo"). */
  label: string;
  /**
   * Percorso dell'immagine dell'avatar (in /public). Le grafiche arriveranno
   * in seguito: finche' e' undefined si usa il placeholder emoji.
   */
  image?: string;
  /** Sfondo della piastra circolare del placeholder (CSS gradient). */
  plate: string;
  /** Colore dell'alone luminoso dietro l'avatar. */
  aura: string;
  /** Ombra colorata proiettata dalla piastra. */
  shadow: string;
}

export interface WorldConfig {
  id: string;
  level: PlayerLevel;
  name: string;
  /** Sottotitolo evocativo: da dove parte a dove arriva lo scenario. */
  tagline: string;
  /** Emoji placeholder della mascotte (finche' non ci sono le immagini). */
  mascotEmoji: string;
  /**
   * TESTATA DEL PERCORSO: i tre colori del gradiente diagonale (112deg) su
   * cui poggiano avatar, livello e barra dell'esperienza.
   *
   * Sono volutamente SCURI e vicini al blu del club: la testata deve fare da
   * base neutra sia all'accent del percorso sia alla banda tricolore che la
   * chiude in basso. Il terzo colore e' l'unico che "sa" di bioma (blu
   * profondo per il mare, terra per il bosco, verde per la palude).
   */
  hero: [string, string, string];
  /**
   * RAMPA CONTINUA DELLO SFONDO (dal chiaro allo scuro).
   *
   * E' la sorgente di verita' per il fondale della mappa: i colori vengono
   * campionati con `rampColor` lungo TUTTA l'altezza del percorso, cosi' che
   * la discesa nell'habitat sia un unico degrade' senza stacchi. Il primo
   * colore e' la "superficie" (prime tappe, luce piena), l'ultimo e' il
   * cuore piu' fitto/oscuro dell'ambiente (ultime tappe).
   *
   * Nota: i colori sono pensati per essere MONOTONI in luminosita' — ogni
   * stop e' un po' piu' scuro del precedente — altrimenti si vedrebbero di
   * nuovo delle "fasce".
   */
  gradient: string[];
  /**
   * Cielo: colore all'inizio del percorso → colore alla fine.
   * Usati per gli accenti (header, decorazioni), non piu' per il fondale.
   */
  skyStart: string;
  skyEnd: string;
  /** Terreno/acqua: inizio → fine. */
  groundStart: string;
  groundEnd: string;
  /** Sole/luce: inizio → fine (tramonta man mano che si avanza). */
  sunStart: string;
  sunEnd: string;
  /** Colore delle tappe completate e degli elementi "attivi" del mondo. */
  accent: string;
  /** Variante scura dell'accent (ombra 3D dei pulsanti tappa). */
  accentDark: string;
  /** I tre stadi evolutivi dell'avatar. */
  tiers: [MascotTier, MascotTier, MascotTier];
}

// ─── Configurazione dei tre mondi ───────────────────────────────────────────

export const WORLDS: Record<PlayerLevel, WorldConfig> = {
  DELFINO: {
    id: 'delfino',
    level: 'DELFINO',
    name: 'Delfino',
    tagline: 'Dal bagnasciuga al mare aperto',
    mascotEmoji: '🐬',
    hero: ['#122A45', '#0E2036', '#0B3F5E'],
    // Superficie soleggiata → acqua bassa → mare aperto → abisso.
    gradient: [
      '#EAF8FF',
      '#BCE7FB',
      '#84CCF1',
      '#4A9CD6',
      '#2168A9',
      '#0F3C6E',
      '#071D33',
    ],
    skyStart: '#BAE6FD',
    skyEnd: '#0A2C49',
    groundStart: '#7DD3FC',
    groundEnd: '#0C1E3D',
    sunStart: '#FCD34D',
    sunEnd: '#F97316',
    accent: '#0EA5E9',
    accentDark: '#0369A1',
    tiers: [
      {
        id: 'cucciolo',
        label: 'Cucciolo',
        image: '/percorsi/delfino/cucciolo.png',
        plate: 'radial-gradient(circle, #DBEAFE, #BAE6FD)',
        aura: '#7DD3FC',
        shadow: 'rgba(56, 189, 248, 0.45)',
      },
      {
        id: 'ragazzo',
        label: 'Ragazzo',
        image: '/percorsi/delfino/ragazzo.png',
        plate: 'radial-gradient(circle, #38BDF8, #0284C7)',
        aura: '#0EA5E9',
        shadow: 'rgba(14, 165, 233, 0.55)',
      },
      {
        id: 'adulto',
        label: 'Adulto',
        image: '/percorsi/delfino/adulto.png',
        plate: 'radial-gradient(circle, #0C4A6E, #082F49)',
        aura: '#FCD34D',
        shadow: 'rgba(245, 185, 33, 0.6)',
      },
    ],
  },
  CERBIATTO: {
    id: 'cerbiatto',
    level: 'CERBIATTO',
    name: 'Cerbiatto',
    tagline: 'Dalla radura al bosco fitto',
    mascotEmoji: '🦌',
    hero: ['#1A2E52', '#1A2046', '#53372A'],
    // Radura dorata → sottobosco → bosco fitto → cuore buio della foresta.
    gradient: [
      '#FDF6C9',
      '#DDEFA4',
      '#ACD679',
      '#71AE59',
      '#417E46',
      '#20512F',
      '#0C2A1B',
    ],
    skyStart: '#FDE68A',
    skyEnd: '#1E1B4B',
    groundStart: '#86EFAC',
    groundEnd: '#14532D',
    sunStart: '#FB923C',
    sunEnd: '#7C2D12',
    accent: '#16A34A',
    accentDark: '#14532D',
    tiers: [
      {
        id: 'cucciolo',
        label: 'Cucciolo',
        image: '/percorsi/cerbiatto/cucciolo.png',
        plate: 'radial-gradient(circle, #FEF9C3, #BBF7D0)',
        aura: '#86EFAC',
        shadow: 'rgba(132, 204, 22, 0.4)',
      },
      {
        id: 'ragazzo',
        label: 'Ragazzo',
        image: '/percorsi/cerbiatto/ragazzo.png',
        plate: 'radial-gradient(circle, #65A30D, #3F6212)',
        aura: '#84CC16',
        shadow: 'rgba(101, 163, 13, 0.55)',
      },
      {
        id: 'adulto',
        label: 'Adulto',
        image: '/percorsi/cerbiatto/adulto.png',
        plate: 'radial-gradient(circle, #14532D, #052E16)',
        aura: '#FCD34D',
        shadow: 'rgba(245, 185, 33, 0.6)',
      },
    ],
  },
  COCCODRILLO: {
    id: 'coccodrillo',
    level: 'COCCODRILLO',
    name: 'Coccodrillo',
    tagline: 'Dallo stagno alla palude oscura',
    mascotEmoji: '🐊',
    hero: ['#1B324C', '#1A232E', '#183A2B'],
    // Stagno al sole → canneto → palude → fondo melmoso.
    gradient: [
      '#FBEEC4',
      '#DDEA9E',
      '#B2CE6E',
      '#80A54A',
      '#527732',
      '#2C4D1E',
      '#12240D',
    ],
    skyStart: '#FED7AA',
    skyEnd: '#1C1917',
    groundStart: '#A3E635',
    groundEnd: '#1A2E05',
    sunStart: '#F59E0B',
    sunEnd: '#7F1D1D',
    accent: '#65A30D',
    accentDark: '#365314',
    tiers: [
      {
        id: 'cucciolo',
        label: 'Cucciolo',
        image: '/percorsi/coccodrillo/cucciolo.png',
        plate: 'radial-gradient(circle, #BEF264, #84CC16)',
        aura: '#A3E635',
        shadow: 'rgba(132, 204, 22, 0.4)',
      },
      {
        id: 'ragazzo',
        label: 'Ragazzo',
        image: '/percorsi/coccodrillo/ragazzo.png',
        plate: 'radial-gradient(circle, #4D7C0F, #365314)',
        aura: '#65A30D',
        shadow: 'rgba(101, 163, 13, 0.55)',
      },
      {
        id: 'adulto',
        label: 'Adulto',
        image: '/percorsi/coccodrillo/adulto.png',
        plate: 'radial-gradient(circle, #1A2E05, #0C0A09)',
        aura: '#EF4444',
        shadow: 'rgba(239, 68, 68, 0.55)',
      },
    ],
  },
};

/** Ordine dei mondi: finito un percorso si passa al livello successivo. */
export const WORLD_ORDER: PlayerLevel[] = ['DELFINO', 'CERBIATTO', 'COCCODRILLO'];

/** Livello successivo nel percorso di crescita (null = ultimo livello). */
export function nextLevel(level: PlayerLevel): PlayerLevel | null {
  const i = WORLD_ORDER.indexOf(level);
  if (i < 0 || i >= WORLD_ORDER.length - 1) return null;
  return WORLD_ORDER[i + 1];
}

/**
 * Principio dei tre livelli: lo stadio dell'avatar dipende dalla frazione di
 * tappe completate.
 *   [0, 1/3)  → 0 (Cucciolo)
 *   [1/3, 2/3)→ 1 (Ragazzo)
 *   [2/3, 1]  → 2 (Adulto)
 */
export function tierForCompletion(completed: number, total: number): 0 | 1 | 2 {
  if (total <= 0) return 0;
  const f = completed / total;
  if (f >= 2 / 3) return 2;
  if (f >= 1 / 3) return 1;
  return 0;
}

// ─── Utility colore (interpolazione lineare tra due hex) ────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

function channel(x: number): string {
  return Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
}

/** Interpola tra due colori hex (t in [0,1]). Usata per il morphing dello scenario. */
export function lerpColor(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return `#${channel(A[0] + (B[0] - A[0]) * k)}${channel(A[1] + (B[1] - A[1]) * k)}${channel(A[2] + (B[2] - A[2]) * k)}`;
}

/**
 * Campiona una RAMPA multi-colore in un punto t ∈ [0,1].
 *
 * `stops` e' la lista di colori equispaziati (es. `world.gradient`): la
 * funzione trova il segmento in cui cade t e interpola con `lerpColor`.
 * Serve per ottenere il colore dello sfondo a una data profondita' del
 * percorso senza creare fasce nette.
 */
export function rampColor(stops: readonly string[], t: number): string {
  if (stops.length === 0) return '#000000';
  if (stops.length === 1) return stops[0];
  const k = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(k));
  return lerpColor(stops[i], stops[i + 1], k - i);
}

/**
 * Easing della profondita': tiene le prime tappe piu' luminose e accelera
 * l'oscuramento verso il fondo, come quando si entra progressivamente nel
 * folto (o sotto la superficie dell'acqua).
 */
export function easeDepth(p: number): number {
  const x = Math.max(0, Math.min(1, p));
  return Math.pow(x, 1.25);
}

/**
 * Pseudo-random DETERMINISTICO in [0,1): stessa (i, salt) → stesso valore.
 * Serve per decorare lo scenario (bolle, alberi, ninfee) senza che gli
 * elementi "saltino" a ogni render.
 */
export function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
