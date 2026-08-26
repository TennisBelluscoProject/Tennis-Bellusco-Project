/**
 * Geometria della mappa dei 12 passi.
 * Esegui con: npm test
 *
 * Questi test non guardano l'aspetto: fissano le PROPRIETA' da cui dipende il
 * fatto che la mappa si legga.
 *
 *   1. le righe sono INTERVALLI DISGIUNTI sull'asse verticale — un passo non
 *      puo' invadere lo spazio del passo successivo ne' quello di un divisore
 *      di sezione, per costruzione e non per taratura dei numeri;
 *   2. il ritmo e' IRREGOLARE — il sentiero non deve rimbalzare fra due sole
 *      sponde alla stessa distanza, altrimenti non sembra un sentiero ma una
 *      tabella;
 *   3. la curva passa dai nodi e scende sempre, senza tornare indietro.
 */
import { describe, it, expect } from 'vitest';
import {
  GEO_DESKTOP,
  GEO_MOBILE,
  bandFor,
  buildLayout,
  buildTrail,
  xFor,
  type Geo,
  type LayoutStep,
} from '@/lib/kids/map-layout';

const FORMATI: ReadonlyArray<readonly [string, Geo]> = [
  ['telefono', GEO_MOBILE],
  ['desktop', GEO_DESKTOP],
];

/**
 * Dodici passi come li produce `computeKidsState`: sei tappe da due, e la
 * sezione si apre sul primo passo di ogni coppia (indici pari).
 */
function dodiciPassi(): LayoutStep[] {
  return Array.from({ length: 12 }, (_, i) => ({ startsSection: i % 2 === 0 }));
}

/** [alto, basso] della riga di un passo. */
const rigaPasso = (y: number, i: number, g: Geo): [number, number] => [
  y - bandFor(i, g) / 2,
  y + bandFor(i, g) / 2,
];

/** [alto, basso] della fascia di un divisore. */
const rigaSezione = (y: number, g: Geo): [number, number] => [
  y - g.sectionBand / 2,
  y + g.sectionBand / 2,
];

/**
 * Le righe adiacenti si TOCCANO per costruzione (il fondo di una e' l'inizio
 * della successiva), quindi il confronto ha una tolleranza: senza, l'errore di
 * arrotondamento sulle altezze frazionarie le farebbe risultare sovrapposte di
 * un decimillesimo di pixel.
 */
const EPS = 1e-6;
const sovrapposti = (a: [number, number], b: [number, number]) =>
  a[1] > b[0] + EPS && b[1] > a[0] + EPS;

describe('buildLayout — le righe non si sovrappongono', () => {
  for (const [nome, g] of FORMATI) {
    it(`${nome}: passi consecutivi occupano intervalli disgiunti`, () => {
      const { stepY } = buildLayout(dodiciPassi(), g);
      for (let i = 1; i < stepY.length; i++) {
        expect(
          sovrapposti(rigaPasso(stepY[i - 1], i - 1, g), rigaPasso(stepY[i], i, g))
        ).toBe(false);
      }
    });

    it(`${nome}: la fascia del divisore non invade le righe dei passi vicini`, () => {
      const { stepY, sectionY } = buildLayout(dodiciPassi(), g);
      let sezioni = 0;

      sectionY.forEach((y, i) => {
        if (y === null) return;
        sezioni += 1;
        const fascia = rigaSezione(y, g);
        expect(sovrapposti(fascia, rigaPasso(stepY[i], i, g))).toBe(false);
        if (i > 0) {
          expect(sovrapposti(fascia, rigaPasso(stepY[i - 1], i - 1, g))).toBe(false);
        }
      });

      // Sei tappe da due passi.
      expect(sezioni).toBe(6);
    });

    it(`${nome}: l'altezza totale e' la somma delle righe`, () => {
      const { totalH } = buildLayout(dodiciPassi(), g);
      const passi = Array.from({ length: 12 }, (_, i) => bandFor(i, g)).reduce(
        (a, b) => a + b,
        0
      );
      expect(totalH).toBeCloseTo(g.topPad + passi + 6 * g.sectionBand + g.finish, 6);
    });
  }

  it('il divisore precede sempre il passo che apre', () => {
    const g = GEO_MOBILE;
    const { stepY, sectionY } = buildLayout(dodiciPassi(), g);
    sectionY.forEach((y, i) => {
      if (y === null) return;
      expect(y).toBeLessThan(stepY[i]);
    });
  });

  it('percorso vuoto: resta solo il traguardo', () => {
    const { stepY, totalH } = buildLayout([], GEO_MOBILE);
    expect(stepY).toEqual([]);
    expect(totalH).toBe(GEO_MOBILE.topPad + GEO_MOBILE.finish);
  });
});

describe('il ritmo e\u0027 irregolare', () => {
  for (const [nome, g] of FORMATI) {
    it(`${nome}: i passi non usano due sole posizioni orizzontali`, () => {
      const posizioni = new Set(Array.from({ length: 12 }, (_, i) => xFor(i, g)));
      expect(posizioni.size).toBeGreaterThan(2);
    });

    it(`${nome}: non e' una semplice alternanza destra/sinistra`, () => {
      // Se lo fosse, il lato cambierebbe a ogni passo senza eccezioni.
      const lati = Array.from({ length: 12 }, (_, i) => xFor(i, g) <= g.vbW / 2);
      const alternanzaPerfetta = lati.every((s, i) => i === 0 || s !== lati[i - 1]);
      expect(alternanzaPerfetta).toBe(false);
    });

    it(`${nome}: due passi consecutivi non finiscono incolonnati`, () => {
      for (let i = 1; i < 12; i++) {
        const dx = Math.abs(xFor(i, g) - xFor(i - 1, g));
        expect(dx).toBeGreaterThan(g.vbW * 0.1);
      }
    });

    it(`${nome}: le righe non sono tutte della stessa altezza`, () => {
      const altezze = new Set(Array.from({ length: 12 }, (_, i) => bandFor(i, g)));
      expect(altezze.size).toBeGreaterThan(1);
    });
  }
});

describe('buildTrail — il sentiero passa dai nodi e scende sempre', () => {
  it('a posizione intera la curva sta esattamente sul nodo', () => {
    const g = GEO_MOBILE;
    const layout = buildLayout(dodiciPassi(), g);
    const trail = buildTrail(layout, g);

    layout.stepY.forEach((y, i) => {
      const [px, py] = trail.pointAt(i);
      expect(px).toBeCloseTo(xFor(i, g), 6);
      expect(py).toBeCloseTo(y, 6);
    });

    const [fx, fy] = trail.pointAt(trail.segments.length);
    expect(fx).toBeCloseTo(g.vbW / 2, 6);
    expect(fy).toBeCloseTo(layout.finishY, 6);
  });

  it('non torna mai indietro: la mascotte scende e basta', () => {
    for (const [, g] of FORMATI) {
      const trail = buildTrail(buildLayout(dodiciPassi(), g), g);
      let precedente = -Infinity;
      for (let i = 0; i < trail.segments.length; i++) {
        for (let k = 0; k <= 60; k++) {
          const [, y] = trail.segments[i].at(k / 60);
          expect(y).toBeGreaterThanOrEqual(precedente - 1e-9);
          precedente = y;
        }
      }
    }
  });

  it('posizioni fuori scala vengono limitate agli estremi', () => {
    const g = GEO_MOBILE;
    const layout = buildLayout(dodiciPassi(), g);
    const trail = buildTrail(layout, g);

    expect(trail.pointAt(-5)[1]).toBeCloseTo(layout.stepY[0], 6);
    expect(trail.pointAt(999)[1]).toBeCloseTo(layout.finishY, 6);
  });
});
