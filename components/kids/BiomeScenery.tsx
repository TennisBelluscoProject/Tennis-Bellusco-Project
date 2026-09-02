'use client';

/**
 * ╭──────────────────────────────────────────────────────────────────────╮
 * │  SCENARIO DEI BIOMI — il terreno che accompagna il sentiero           │
 * ╰──────────────────────────────────────────────────────────────────────╯
 *
 * Disegna quello che sta ai LATI del sentiero dei 12 passi: fondale roccioso
 * e alghe per il Delfino, sottobosco e abeti per il Cerbiatto, riva melmosa e
 * cipressi per il Coccodrillo. Il degrade' continuo del fondo NON sta qui: lo
 * fa `SceneBackground` in KidsPathMap, perche' e' l'unica cosa che deve potersi
 * stirare quando la mappa si accorcia.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COSA NON ANDAVA, E COSA LO SOSTITUISCE
 *
 * 1. LA VEGETAZIONE SBORDAVA DAL TERRENO.
 *    La versione precedente decideva l'ascissa della BASE e la teneva dentro
 *    la sponda, ma ogni sagoma cresce `largo` unita' A DESTRA E A SINISTRA
 *    della base. Un elemento con la base a un passo dal ciglio finiva quindi
 *    per meta' sull'acqua aperta: la radice si vedeva appoggiata, la chioma
 *    no. E' il difetto che faceva sembrare tutto appiccicato sopra al fondale.
 *    Adesso si ragiona sull'INGOMBRO INTERO: si calcola la larghezza utile
 *    alla quota `y`, si RIDUCE la scala finche' la sagoma ci sta dentro tutta,
 *    e solo allora si sceglie dove metterla. Niente puo' piu' sporgere,
 *    perche' non c'e' un valore da tarare: e' una disuguaglianza.
 *
 * 2. LE DUE SPONDE SI SCAVALCAVANO.
 *    Erano due profili di larghezza simile e fase diversa, quindi ora sporgeva
 *    una ora l'altra e il terreno non aveva un ordine leggibile. Adesso sono
 *    ANNIDATE PER COSTRUZIONE: la `cresta` e' definita come una FRAZIONE della
 *    `riva` (sempre fra 0.34 e 0.50), quindi sta dentro sempre e comunque.
 *    Si leggono come due gradini di uno stesso pendio che sale dal sentiero
 *    verso il bordo della mappa, non come due ritagli sovrapposti.
 *
 * 3. IL TERRENO NON SI STACCAVA DAL FONDALE.
 *    Adesso ogni gradino PROIETTA LA SUA OMBRA su quello piu' in basso — la
 *    riva sul corridoio del sentiero, la cresta sulla riva — con tre scalini
 *    di opacita' che imitano una sfocatura. Un'ombra portata e' il segnale
 *    piu' economico e piu' forte per dire "questa superficie e' RIALZATA
 *    rispetto a quella".
 *
 * 4. OGNI COSA CHE POGGIA HA IL SUO DOSSO.
 *    Sotto ogni elemento c'e' una cupola schiacciata del colore del terreno,
 *    appena piu' chiara in cima. Non e' decorazione: e' il terreno che si
 *    gonfia localmente, quindi la sagoma non "tocca" il suolo, ci ESCE. Sopra
 *    il dosso va l'ombra di contatto, e nella palude anche un'increspatura,
 *    perche' li' il dosso e' un isolotto di melma in mezzo all'acqua.
 *
 * 5. NIENTE GALLEGGIA SENZA MOTIVO.
 *    Chi sta per aria (pesci, meduse) porta la PROPRIA OMBRA PROIETTATA sul
 *    fondo, che e' quello che dice "sto sospeso apposta" invece di "sono un
 *    adesivo". Le bolle escono da una fumarola, la libellula e' posata su una
 *    canna, le lucciole stanno sopra un cespuglio. La pinna di squalo — che
 *    era una sagoma sospesa in mezzo al nulla — non c'e' piu'.
 *
 * 6. LA FOGLIA NON HA IL COLORE DELLA TERRA.
 *    Prima suolo e vegetazione campionavano lo stesso punto della rampa, e
 *    infatti le piante sparivano dentro la sponda. Adesso il suolo e' spinto
 *    PIU' AVANTI nella rampa (piu' scuro) e la vegetazione meno: le sagome si
 *    staccano sempre, a ogni profondita', senza usare contorni.
 *
 * L'ordine di disegno e' la profondita': prima tutto il terreno, poi la
 * vegetazione lontana sulla cresta, poi quella di mezzo, poi il primo piano.
 * Dentro ogni passata le sagome sono ordinate per `y` crescente, cosi' quella
 * piu' in basso copre quella piu' in alto: e' la regola che regge tutte le
 * mappe a scorrimento verticale, e da sola risolve gli accavallamenti.
 *
 * Tutto e' deterministico (`seeded`): stessa mappa, stesso disegno a ogni
 * render, cosi' la vegetazione non balla quando l'allievo spunta un obiettivo.
 *
 * Componente PURAMENTE DECORATIVO: non riceve stato, non ha eventi, e sta
 * dentro un <svg> gia' marcato `aria-hidden`. E' memoizzato perche' durante il
 * cammino della mascotte la mappa si ridisegna a 60 fps e ricostruire un
 * migliaio di sagome a ogni frame non ha senso.
 */

import { memo, type ReactNode } from 'react';
import { easeDepth, lerpColor, rampColor, seeded, type WorldConfig } from '@/lib/paths/worlds';
import type { Geo } from '@/lib/kids/map-layout';

// ════════════════════════════════════════════════════════════════════════════
//  REGOLE DI INGOMBRO
// ════════════════════════════════════════════════════════════════════════════

/**
 * Frazione di vbW oltre la quale NESSUN pixel di terreno puo' spingersi.
 *
 * Il nodo piu' a sinistra sta a `xPattern` = 0.28/0.30 e il piu' grande
 * (`nodeCurrent`) ha mezzo diametro di ingombro: su telefono il bordo sinistro
 * del nodo cade intorno a 0.187 * vbW. Stando sotto 0.175 resta un margine
 * anche per lo sbandamento della curva fra un nodo e l'altro.
 *
 * L'unica cosa che lo supera e' l'OMBRA PORTATA della riva, che e' una velatura
 * al 5% e non compete con niente: anzi, e' proprio quella a dire che il
 * corridoio del sentiero sta piu' in basso del terreno.
 */
const LIMITE = 0.175;

/** Unita' del viewBox lasciate libere fra la vegetazione e il ciglio della riva. */
const MARGINE = 3;

/** Colore delle ombre di contatto e portate: un nero appena virato al verde. */
const NERO = '#03100B';

// ════════════════════════════════════════════════════════════════════════════
//  IL PROFILO DEL TERRENO
// ════════════════════════════════════════════════════════════════════════════

/**
 * Tre onde con lunghezze PRIME FRA LORO: la somma non si ripete mai lungo i
 * ~2000 pixel di una mappa, quindi il bordo non mostra il "motivo".
 * I pesi sommano a 1, cosi' il risultato resta in [-1, 1].
 */
const ONDE = [
  { onda: 233, peso: 0.44 },
  { onda: 109, peso: 0.33 },
  { onda: 47, peso: 0.23 },
] as const;

function ondulazione(y: number, sale: number): number {
  let v = 0;
  for (let i = 0; i < ONDE.length; i++) {
    const fase = seeded(i + 3, sale) * Math.PI * 2;
    v += ONDE[i].peso * Math.sin((y / ONDE[i].onda) * Math.PI * 2 + fase);
  }
  return v;
}

/**
 * Larghezza media e ondeggiamento della RIVA, in frazione di vbW.
 *
 * Il massimo (0.126 + 0.034 = 0.160) sta sotto `LIMITE` con quasi sei unita'
 * di margine: e' li' che sta la frangia, che sporge un po' oltre il ciglio per
 * non farlo sembrare tagliato con le forbici.
 */
const RIVA_MEDIA = 0.126;
const RIVA_AMP = 0.034;

/**
 * La CRESTA come frazione della riva. Restando fra 0.30 e 0.56 e' ANNIDATA per
 * costruzione: non esiste una quota in cui possa sbucare fuori dalla riva, che
 * era il difetto delle due sponde di pari larghezza e fase diversa.
 *
 * L'intervallo e' AMPIO di proposito: se i due cigli avessero larghezza quasi
 * proporzionale correrebbero paralleli, e due curve parallele si leggono come
 * un nastro decorativo invece che come due quote di uno stesso pendio.
 */
const CRESTA_MIN = 0.3;
const CRESTA_VAR = 0.26;

/** Larghezza di un gradino di terreno, in UNITA' del viewBox, alla quota y. */
type Larghezza = (y: number) => number;

interface Profili {
  /** Ciglio verso il sentiero: e' il gradino piu' basso e piu' vicino. */
  riva: Larghezza;
  /** Gradino alto, contro il bordo della mappa: piu' lontano, piu' velato. */
  cresta: Larghezza;
}

function profiliDi(lato: 1 | -1, vbW: number): Profili {
  const sale = lato === 1 ? 17 : 58;
  const tetto = LIMITE * vbW;
  const riva: Larghezza = (y) =>
    Math.min(tetto, (RIVA_MEDIA + RIVA_AMP * ondulazione(y, sale)) * vbW);
  const cresta: Larghezza = (y) =>
    riva(y) * (CRESTA_MIN + CRESTA_VAR * (0.5 + 0.5 * ondulazione(y, sale + 29)));
  return { riva, cresta };
}

// ─── Da profilo a path ──────────────────────────────────────────────────────

/** Arrotonda a un decimale: i path restano leggeri senza perdere qualita'. */
const n = (v: number) => Math.round(v * 10) / 10;

/** Campiona un profilo lungo tutta l'altezza. `extra` sposta il bordo verso il centro. */
function campiona(
  w: Larghezza,
  lato: 1 | -1,
  totalH: number,
  vbW: number,
  extra = 0
): [number, number][] {
  const passo = 14;
  const N = Math.max(3, Math.ceil(totalH / passo));
  const out: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const y = (i / N) * totalH;
    const ins = w(y) + extra;
    out.push([lato === 1 ? ins : vbW - ins, y]);
  }
  return out;
}

/**
 * Polilinea → curva continua con la regola dei punti medi.
 *
 * Ogni vertice diventa il punto di controllo di una quadratica che va dal
 * punto medio precedente al successivo: il risultato e' derivabile ovunque,
 * quindi il ciglio del terreno non ha MAI spigoli.
 */
function linea(pts: readonly [number, number][]): string {
  let d = `M ${n(pts[0][0])} ${n(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    d += ` Q ${n(x)} ${n(y)} ${n((x + nx) / 2)} ${n((y + ny) / 2)}`;
  }
  const u = pts[pts.length - 1];
  return `${d} L ${n(u[0])} ${n(u[1])}`;
}

/** La stessa curva, chiusa contro il bordo della mappa: diventa una massa piena. */
function massa(pts: readonly [number, number][], ancora: number, totalH: number): string {
  return `${linea(pts)} L ${n(ancora)} ${n(totalH)} L ${n(ancora)} 0 Z`;
}

// ─── Primitive di disegno ───────────────────────────────────────────────────

/** Ellisse come dato di path: si concatena con altre in un solo <path>. */
function ell(cx: number, cy: number, rx: number, ry: number): string {
  return (
    `M ${n(cx - rx)} ${n(cy)} a ${n(rx)} ${n(ry)} 0 1 0 ${n(rx * 2)} 0 ` +
    `a ${n(rx)} ${n(ry)} 0 1 0 ${n(-rx * 2)} 0 Z`
  );
}

/**
 * Lente: due archi che si richiudono fra due punti.
 *
 * E' la forma che da' MASSA a foglie, fronde e petali. Le linee con `stroke`
 * a distanza spariscono o si impastano; una lente piena si legge sempre.
 */
function lente(x1: number, y1: number, x2: number, y2: number, k: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const nx = -(y2 - y1) * k;
  const ny = (x2 - x1) * k;
  return (
    `M ${n(x1)} ${n(y1)} Q ${n(mx + nx)} ${n(my + ny)} ${n(x2)} ${n(y2)} ` +
    `Q ${n(mx - nx)} ${n(my - ny)} ${n(x1)} ${n(y1)} Z`
  );
}

/** Punto su un'ellisse a un dato angolo. Serve alla tacca della ninfea. */
function suEllisse(cx: number, cy: number, rx: number, ry: number, a: number): string {
  return `${n(cx + rx * Math.cos(a))} ${n(cy + ry * Math.sin(a))}`;
}

/**
 * DOSSO: la cupola di terreno da cui la sagoma esce.
 *
 * E' la differenza fra un albero POSATO sul fondale e un albero che CRESCE dal
 * terreno. Del colore del suolo, appena piu' chiara in cima perche' la luce
 * viene dall'alto: si salda con la sponda e non si legge come un oggetto a
 * parte, si legge come il terreno che si gonfia li' sotto.
 */
function dosso(x: number, y: number, w: number): string {
  // Basso: e' un GONFIORE del terreno, non una collinetta. Piu' alto di cosi'
  // smetteva di saldarsi con la sponda e tornava a leggersi come un oggetto
  // a se' — una cupola chiara appoggiata sopra al verde.
  const h = w * 0.24;
  return (
    `M ${n(x - w)} ${n(y)} ` +
    `C ${n(x - w * 0.66)} ${n(y - h * 1.04)} ${n(x - w * 0.24)} ${n(y - h)} ${n(x)} ${n(y - h)} ` +
    `C ${n(x + w * 0.24)} ${n(y - h)} ${n(x + w * 0.66)} ${n(y - h * 1.04)} ${n(x + w)} ${n(y)} Z`
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  IL PENNELLO PASSATO A OGNI SPECIE
// ════════════════════════════════════════════════════════════════════════════

interface Pennello {
  /** Ascissa della base: e' un punto DENTRO il gradino, garantito. */
  x: number;
  /** Ordinata della base: e' da qui che l'elemento cresce verso l'alto. */
  y: number;
  /** Scala: 1 ≈ un elemento alto una sessantina di unita'. */
  s: number;
  /** Colore pieno della sagoma. Piu' CHIARO del suolo, cosi' si stacca. */
  c: string;
  /** Variante chiara: rilievi, luce di bordo, riflessi. */
  hi: string;
  /** Variante scura: tronchi, cavita', ombre interne. */
  sc: string;
  /**
   * PIETRA: il tono minerale, e non e' un vezzo.
   *
   * Rocce e ciottoli usavano `c`, cioe' il colore del fogliame. Un masso
   * verde chiaro in mezzo al bosco non si legge come un masso: si legge come
   * una collinetta, ed era la sagoma che sembrava piu' fuori posto di tutte.
   * La pietra e' lo stesso tono del suolo tirato verso un grigio neutro,
   * cosi' resta dentro la tavolozza del bioma ma smette di essere vegetale.
   */
  pi: string;
  /** Pietra in luce: serve la faccia superiore, altrimenti resta una macchia. */
  piHi: string;
  /** +1 se l'elemento sta a sinistra (il centro mappa e' verso +x), -1 a destra. */
  dir: 1 | -1;
  /** Pseudo-casuale deterministico dell'elemento. */
  r: (salt: number) => number;
}

type Specie = (p: Pennello) => ReactNode;

/** Come l'elemento sta al suolo. */
type Posa =
  /** Poggia: dosso di terreno sotto e ombra di contatto. */
  | 'suolo'
  /** Sta a galla: niente dosso, ma le increspature intorno. */
  | 'acqua'
  /** Sta sospeso: si alza da terra e proietta la SUA ombra sul fondo. */
  | 'volo';

/** Una voce del catalogo di un bioma. */
interface Voce {
  disegna: Specie;
  /**
   * SEMILARGHEZZA a scala 1, in unita' del viewBox.
   *
   * E' il numero su cui si regge tutto il capitolo 1 del commento in testa:
   * la sagoma occupa `[x - largo, x + largo]` e la struttura garantisce che
   * QUELL'INTERVALLO stia dentro il terreno. Se una specie dichiara un `largo`
   * piu' piccolo del suo disegno reale, tornera' a sporgere: e' l'unico dato
   * di questo file che va tenuto onesto a mano.
   */
  largo: number;
  posa?: Posa;
  /** Profondita' minima perche' compaia (0 = fin dalla superficie). */
  da?: number;
  /** Profondita' oltre la quale sparisce. */
  a?: number;
  /** Peso nella scelta: piu' alto = piu' frequente. */
  peso?: number;
  /** Passate ammesse (0 = cresta lontana, 1 = mezzo, 2 = primo piano). */
  passi?: readonly number[];
}

// ════════════════════════════════════════════════════════════════════════════
//  SPECIE COMUNI A TUTTI I BIOMI
// ════════════════════════════════════════════════════════════════════════════

/**
 * Ciuffo d'erba (o di alghe corte): il riempitivo che non puo' mai sembrare
 * sospeso, perche' e' tutto attaccato alla base e non ha chioma da reggere.
 * Serve a NON avere buchi di terreno nudo fra un elemento grande e l'altro.
 */
const Erba: Specie = (p) => {
  const lame: string[] = [];
  for (let i = 0; i < 7; i++) {
    const bx = p.x + (i - 3) * 2.5 * p.s;
    const h = (7 + p.r(i + 1) * 9) * p.s;
    const pend = (p.r(i + 11) - 0.35) * h * 0.5;
    lame.push(
      `M ${n(bx - 1.15 * p.s)} ${n(p.y)} ` +
        `Q ${n(bx + pend * 0.3)} ${n(p.y - h * 0.62)} ${n(bx + pend)} ${n(p.y - h)} ` +
        `Q ${n(bx + pend * 0.1)} ${n(p.y - h * 0.5)} ${n(bx + 1.15 * p.s)} ${n(p.y)} Z`
    );
  }
  return <path d={lame.join(' ')} fill={p.c} />;
};

/**
 * Ciottoli: due o tre sassi appoggiati, con la faccia in alto illuminata.
 *
 * Sono bassi e larghi, quindi comunichino "pavimento" meglio di qualunque
 * elemento verticale: un sasso ha senso solo se c'e' qualcosa sotto.
 */
const Ciottoli: Specie = (p) => {
  const sassi: ReactNode[] = [];
  for (let i = 0; i < 3; i++) {
    const w = (4.5 + p.r(i + 1) * 5) * p.s;
    const h = w * (0.5 + p.r(i + 9) * 0.24);
    const cx = p.x + (i - 1) * 7 * p.s + (p.r(i + 17) - 0.5) * 3 * p.s;
    sassi.push(
      <g key={i}>
        <path
          d={
            `M ${n(cx - w)} ${n(p.y)} Q ${n(cx - w * 0.92)} ${n(p.y - h * 0.9)} ${n(cx - w * 0.2)} ${n(p.y - h)} ` +
            `Q ${n(cx + w * 0.6)} ${n(p.y - h * 0.96)} ${n(cx + w)} ${n(p.y)} Z`
          }
          fill={p.pi}
        />
        <path
          d={
            `M ${n(cx - w * 0.2)} ${n(p.y - h)} Q ${n(cx + w * 0.6)} ${n(p.y - h * 0.96)} ${n(cx + w)} ${n(p.y)} ` +
            `Q ${n(cx + w * 0.3)} ${n(p.y - h * 0.4)} ${n(cx - w * 0.2)} ${n(p.y - h)} Z`
          }
          fill={p.piHi}
          opacity={0.55}
        />
      </g>
    );
  }
  return <>{sassi}</>;
};

/**
 * Roccia: profilo tutto a curve, con la faccia rivolta al sentiero in luce.
 *
 * La versione precedente era una spezzata di sette vertici, e a schermo si
 * leggeva come un cuneo di cartone — e' la sagoma spigolosa che si vede in
 * alto a sinistra nel mondo Delfino. Qui il contorno e' fatto di quadratiche
 * e la roccia ha un secondo masso addossato, cosi' ha una base larga invece
 * di poggiare su una punta.
 */
const Roccia: Specie = (p) => {
  const w = 26 * p.s;
  const h = 16 * p.s;
  const d = p.dir;
  const X = (a: number) => p.x + a * w * d;
  const Y = (b: number) => p.y + b * h;

  // Lo SPIGOLO sta fuori centro e le due facce hanno tono diverso. Un profilo
  // simmetrico e monocromo, per quanto ben curvato, produce una cupola — e una
  // cupola in mezzo al bosco si legge come una collina, non come un masso.
  // Sono la rottura di piano e l'asimmetria a dire "roccia", non il contorno.
  //
  // La cresta pero' NON e' un vertice solo: un apice a punta trasforma il
  // masso in una tenda. Sono due punti uniti da un raccordo corto, cioe' uno
  // spigolo consumato — che e' quello che fa una roccia vera.
  const ca: [number, number] = [-0.16, -0.98];
  const cb: [number, number] = [0.04, -1.02];
  const spalla: [number, number] = [-0.34, -0.66];

  return (
    <>
      {/* Masso addossato: sta dietro e piu' basso, allarga l'appoggio. */}
      <path
        d={
          `M ${n(X(-0.66))} ${n(Y(0))} Q ${n(X(-0.7))} ${n(Y(-0.38))} ${n(X(-0.44))} ${n(Y(-0.54))} ` +
          `Q ${n(X(-0.18))} ${n(Y(-0.66))} ${n(X(-0.06))} ${n(Y(0))} Z`
        }
        fill={p.pi}
        opacity={0.72}
      />
      {/* Faccia in ombra, rivolta al bordo della mappa. */}
      <path
        d={
          `M ${n(X(-0.52))} ${n(Y(0))} Q ${n(X(-0.55))} ${n(Y(-0.4))} ${n(X(spalla[0]))} ${n(Y(spalla[1]))} ` +
          `Q ${n(X(-0.26))} ${n(Y(-0.88))} ${n(X(ca[0]))} ${n(Y(ca[1]))} ` +
          `Q ${n(X(-0.06))} ${n(Y(-1.06))} ${n(X(cb[0]))} ${n(Y(cb[1]))} ` +
          `L ${n(X(0.06))} ${n(Y(0))} Z`
        }
        fill={p.pi}
      />
      {/* Faccia in luce, rivolta al sentiero. */}
      <path
        d={
          `M ${n(X(cb[0]))} ${n(Y(cb[1]))} Q ${n(X(0.32))} ${n(Y(-0.72))} ${n(X(0.5))} ${n(Y(0))} ` +
          `L ${n(X(0.06))} ${n(Y(0))} Z`
        }
        fill={p.piHi}
      />
      {/* Filo di luce sullo spigolo: e' quello che rende leggibile la rottura
          di piano anche quando la roccia e' piccola. */}
      <path
        d={
          `M ${n(X(spalla[0]))} ${n(Y(spalla[1]))} Q ${n(X(-0.26))} ${n(Y(-0.88))} ${n(X(ca[0]))} ${n(Y(ca[1]))} ` +
          `Q ${n(X(-0.06))} ${n(Y(-1.06))} ${n(X(cb[0]))} ${n(Y(cb[1]))} ` +
          `Q ${n(X(0.32))} ${n(Y(-0.72))} ${n(X(0.5))} ${n(Y(0))}`
        }
        fill="none"
        stroke={p.piHi}
        strokeWidth={n(0.9 * p.s)}
        strokeLinejoin="round"
        opacity={0.5}
      />
    </>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  MARE — mondo Delfino
// ════════════════════════════════════════════════════════════════════════════

/**
 * Alga laminare: un nastro AFFUSOLATO che ondeggia, con le lamine alternate.
 *
 * Il gambo e' una forma piena costruita salendo lungo un lato e ridiscendendo
 * lungo l'altro, con la semilarghezza che cala verso la cima: e' cosi' che si
 * ottiene un profilo che si assottiglia, cosa che un `stroke` non sa fare.
 */
const Alga: Specie = (p) => {
  const H = 54 * p.s;
  const onda = 6.5 * p.s * p.dir;
  const N = 9;
  const asse = (u: number): [number, number] => [
    p.x + onda * Math.sin(u * 2.4) * (0.3 + u * 0.7),
    p.y - H * u,
  ];
  // Gambo piu' pieno e lamine piu' lunghe: con la versione sottile l'alga si
  // leggeva come un rametto spoglio invece che come una fronda.
  const mezzo = (u: number) => 3.6 * p.s * (1 - u * 0.66);

  const su: string[] = [];
  const giu: string[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const [cx, cy] = asse(u);
    su.push(`${n(cx - mezzo(u))} ${n(cy)}`);
    giu.unshift(`${n(cx + mezzo(u))} ${n(cy)}`);
  }

  const lamine = [0.16, 0.3, 0.44, 0.58, 0.72, 0.86].map((u, i) => {
    const [cx, cy] = asse(u);
    const lato = i % 2 === 0 ? 1 : -1;
    const L = 11.5 * p.s * (1 - u * 0.34);
    return lente(cx, cy, cx + lato * L, cy - L * 0.62, 0.34);
  });

  return (
    <>
      <path d={lamine.join(' ')} fill={p.c} />
      <path d={`M ${su.join(' L ')} L ${giu.join(' L ')} Z`} fill={p.c} />
      <path d={ell(p.x, p.y - 2 * p.s, 3.4 * p.s, 1.6 * p.s)} fill={p.sc} opacity={0.45} />
    </>
  );
};

/** Corallo ramificato: base tozza, quattro rami con la punta arrotondata. */
const Corallo: Specie = (p) => {
  const H = 28 * p.s;
  const rami: string[] = [];
  const punte: ReactNode[] = [];

  for (let i = 0; i < 4; i++) {
    const a = -0.86 + i * 0.57;
    const alt = H * (0.58 + p.r(i + 1) * 0.5);
    const tx = p.x + Math.sin(a) * alt * 0.62;
    const ty = p.y - Math.cos(a) * alt;
    rami.push(
      `M ${n(p.x)} ${n(p.y - H * 0.12)} ` +
        `Q ${n(p.x + Math.sin(a) * alt * 0.2)} ${n(p.y - alt * 0.62)} ${n(tx)} ${n(ty)}`
    );
    punte.push(<circle key={i} cx={n(tx)} cy={n(ty)} r={n(2.3 * p.s)} fill={p.c} />);
  }

  return (
    <>
      <path d={ell(p.x, p.y - 1.5 * p.s, 8.5 * p.s, 3.8 * p.s)} fill={p.c} />
      <path
        d={rami.join(' ')}
        fill="none"
        stroke={p.c}
        strokeWidth={n(3.3 * p.s)}
        strokeLinecap="round"
      />
      {punte}
      <path
        d={ell(p.x + 3 * p.s * p.dir, p.y - 3 * p.s, 3.2 * p.s, 1.3 * p.s)}
        fill={p.hi}
        opacity={0.24}
      />
    </>
  );
};

/** Spugne a tubo: tre canne cave, l'apertura in ombra. Molto riconoscibili. */
const Spugna: Specie = (p) => {
  const tubi: ReactNode[] = [];
  for (let i = 0; i < 3; i++) {
    const dx = (i - 1) * 6.2 * p.s + (p.r(i + 2) - 0.5) * 2.6 * p.s;
    const H = (13 + p.r(i + 7) * 14) * p.s;
    const w = 4.4 * p.s;
    const cx = p.x + dx;
    tubi.push(
      <g key={i}>
        <path
          d={
            `M ${n(cx - w)} ${n(p.y)} L ${n(cx - w * 0.84)} ${n(p.y - H)} ` +
            `a ${n(w * 0.84)} ${n(w * 0.46)} 0 0 1 ${n(w * 1.68)} 0 ` +
            `L ${n(cx + w)} ${n(p.y)} Z`
          }
          fill={p.c}
        />
        <path d={ell(cx, p.y - H, w * 0.6, w * 0.3)} fill={p.sc} opacity={0.55} />
      </g>
    );
  }
  return <>{tubi}</>;
};

/** Stella marina distesa sul fondo: schiacciata in verticale, spigoli tondi. */
const Stella: Specie = (p) => {
  const R = 9.5 * p.s;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? R : R * 0.45;
    pts.push(`${n(p.x + Math.cos(a) * r)} ${n(p.y - R * 0.16 + Math.sin(a) * r * 0.5)}`);
  }
  return (
    <>
      <path
        d={`M ${pts.join(' L ')} Z`}
        fill={p.c}
        stroke={p.c}
        strokeWidth={n(2.4 * p.s)}
        strokeLinejoin="round"
      />
      <path d={ell(p.x, p.y - R * 0.16, R * 0.2, R * 0.1)} fill={p.hi} opacity={0.3} />
    </>
  );
};

/**
 * Anemone: tredici tentacoli SOTTILI e di lunghezza diversa, su un piede basso.
 *
 * Con nove tentacoli spessi e tutti uguali veniva fuori un raggiera compatta
 * che si leggeva come un sole disegnato, non come un animale: gli spessori
 * larghi si toccavano e chiudevano i vuoti. Qui i filamenti sono fini e
 * irregolari, e fra l'uno e l'altro si vede il fondo.
 */
const Anemone: Specie = (p) => {
  const R = 8.5 * p.s;
  const N = 13;
  const tent: string[] = [];
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i - (N - 1) / 2) * 0.235;
    const L = R * (0.7 + p.r(i + 1) * 0.7);
    const bx = p.x + Math.cos(a) * R * 0.4;
    const by = p.y - R * 0.34;
    // Il punto di controllo e' spostato PERPENDICOLARMENTE al raggio: i
    // tentacoli si incurvano tutti nello stesso verso invece di partire
    // dritti. Filamenti rettilinei a raggiera non fanno un animale, fanno un
    // sole disegnato — ed e' esattamente quello che si vedeva.
    const curva = 0.26 * p.dir;
    tent.push(
      `M ${n(bx)} ${n(by)} ` +
        `Q ${n(bx + Math.cos(a) * L * 0.58 - Math.sin(a) * L * curva)} ` +
        `${n(by + Math.sin(a) * L * 0.58 + Math.cos(a) * L * curva)} ` +
        `${n(bx + Math.cos(a) * L * 1.02)} ${n(by + Math.sin(a) * L * 0.96)}`
    );
  }
  return (
    <>
      <path
        d={tent.join(' ')}
        fill="none"
        stroke={p.hi}
        strokeWidth={n(1 * p.s)}
        strokeLinecap="round"
        opacity={0.58}
      />
      <path
        d={`M ${n(p.x - R * 0.72)} ${n(p.y)} a ${n(R * 0.72)} ${n(R * 0.5)} 0 0 1 ${n(R * 1.44)} 0 Z`}
        fill={p.c}
      />
    </>
  );
};

/**
 * Fumarola: la colonna di bolle ESCE DA QUALCOSA.
 *
 * Prima le bolle nascevano a mezz'acqua da un punto qualunque, ed erano fra le
 * cose che si leggevano peggio. Adesso alla base c'e' lo sfiato — un rilievo
 * scuro con la bocca in ombra — e la colonna sale da li': si capisce da dove
 * arriva, quindi non e' piu' un adesivo.
 */
const Fumarola: Specie = (p) => {
  const bolle: ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    bolle.push(
      <circle
        key={i}
        cx={n(p.x + Math.sin(i * 1.7) * (2 + i * 1.5) * p.s)}
        cy={n(p.y - 7 * p.s - i * 8.5 * p.s - p.r(i + 9) * 4 * p.s)}
        r={n((1.2 + p.r(i + 17) * 2) * p.s)}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={n(0.85 * p.s)}
        opacity={0.4 - i * 0.03}
      />
    );
  }
  return (
    <>
      <path
        d={
          `M ${n(p.x - 7 * p.s)} ${n(p.y)} Q ${n(p.x - 5 * p.s)} ${n(p.y - 6 * p.s)} ${n(p.x - 2.4 * p.s)} ${n(p.y - 6.4 * p.s)} ` +
          `L ${n(p.x + 2.4 * p.s)} ${n(p.y - 6.4 * p.s)} Q ${n(p.x + 5 * p.s)} ${n(p.y - 6 * p.s)} ${n(p.x + 7 * p.s)} ${n(p.y)} Z`
        }
        fill={p.sc}
      />
      <path d={ell(p.x, p.y - 6.4 * p.s, 2.6 * p.s, 1.1 * p.s)} fill={NERO} opacity={0.45} />
      {bolle}
    </>
  );
};

/** Banco di pesciolini: corpo a mandorla e coda a cuneo, tutti nello stesso verso. */
const Pesci: Specie = (p) => {
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    const fx = p.x + (p.r(i + 3) - 0.5) * 17 * p.s;
    const fy = p.y - p.r(i + 13) * 18 * p.s;
    const L = (4 + p.r(i + 23) * 2.4) * p.s * p.dir;
    out.push(
      `M ${n(fx)} ${n(fy)} q ${n(L)} ${n(-L * 0.44)} ${n(L * 2)} 0 q ${n(-L)} ${n(L * 0.44)} ${n(-L * 2)} 0 Z ` +
        `M ${n(fx)} ${n(fy)} l ${n(-L * 0.75)} ${n(-L * 0.55)} l 0 ${n(L * 1.1)} Z`
    );
  }
  return <path d={out.join(' ')} fill={p.c} />;
};

/** Medusa: cupola con l'orlo ondulato e i tentacoli che strascicano. */
const Medusa: Specie = (p) => {
  const R = 10 * p.s;
  const tent: string[] = [];
  for (let i = -2; i <= 2; i++) {
    const tx = p.x + i * R * 0.36;
    tent.push(
      `M ${n(tx)} ${n(p.y - R * 0.1)} q ${n(R * 0.32)} ${n(R * 0.9)} ` +
        `${n(i % 2 === 0 ? R * 0.16 : -R * 0.16)} ${n(R * 1.9)}`
    );
  }
  return (
    <>
      <path
        d={tent.join(' ')}
        fill="none"
        stroke={p.c}
        strokeWidth={n(1.4 * p.s)}
        strokeLinecap="round"
        opacity={0.62}
      />
      <path
        d={
          `M ${n(p.x - R)} ${n(p.y)} a ${n(R)} ${n(R * 0.95)} 0 0 1 ${n(R * 2)} 0 ` +
          `q ${n(-R * 0.5)} ${n(R * 0.22)} ${n(-R)} 0 q ${n(-R * 0.5)} ${n(-R * 0.22)} ${n(-R)} 0 Z`
        }
        fill={p.c}
      />
      <path d={ell(p.x - R * 0.3, p.y - R * 0.48, R * 0.26, R * 0.16)} fill={p.hi} opacity={0.32} />
    </>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  BOSCO — mondo Cerbiatto
// ════════════════════════════════════════════════════════════════════════════

/**
 * Abete: cinque falde con la base CONCAVA, non triangoli piatti.
 *
 * La concavita' e' quello che distingue una conifera da un cono: i rami
 * scendono e il bordo inferiore di ogni falda si incurva verso il basso ai
 * lati. Il filo di luce sul lato rivolto al sentiero fa il resto.
 */
const Abete: Specie = (p) => {
  const H = 62 * p.s;
  const W = 23 * p.s;
  const PIANI = 5;
  const corpo: string[] = [];
  const luce: string[] = [];

  for (let i = 0; i < PIANI; i++) {
    const f = i / (PIANI - 1);
    const base = p.y - H * (0.11 + 0.15 * i);
    const cima = p.y - H * (0.11 + 0.15 * i + 0.3);
    const w = W * (1 - f * 0.6);
    corpo.push(
      `M ${n(p.x)} ${n(cima)} L ${n(p.x + w / 2)} ${n(base)} ` +
        `Q ${n(p.x)} ${n(base - w * 0.18)} ${n(p.x - w / 2)} ${n(base)} Z`
    );
    luce.push(`M ${n(p.x)} ${n(cima)} L ${n(p.x + (w / 2) * p.dir)} ${n(base)}`);
  }

  return (
    <>
      <path
        d={
          `M ${n(p.x - 2.3 * p.s)} ${n(p.y)} L ${n(p.x - 1.5 * p.s)} ${n(p.y - H * 0.2)} ` +
          `L ${n(p.x + 1.5 * p.s)} ${n(p.y - H * 0.2)} L ${n(p.x + 2.3 * p.s)} ${n(p.y)} Z`
        }
        fill={p.sc}
      />
      <path d={corpo.join(' ')} fill={p.c} />
      <path
        d={luce.join(' ')}
        fill="none"
        stroke={p.hi}
        strokeWidth={n(1.5 * p.s)}
        strokeLinecap="round"
        opacity={0.2}
      />
    </>
  );
};

/** Latifoglia: tronco che si biforca e chioma fatta di quattro masse tonde. */
const Latifoglia: Specie = (p) => {
  const H = 54 * p.s;
  const R = 15 * p.s;
  const cy = p.y - H + R * 0.8;
  const masse: [number, number, number][] = [
    [-0.64, 0.44, 0.66],
    [0.62, 0.46, 0.6],
    [-0.18, -0.26, 0.82],
    [0.32, -0.12, 0.7],
  ];

  return (
    <>
      <path
        d={
          `M ${n(p.x - 3 * p.s)} ${n(p.y)} Q ${n(p.x - 1.7 * p.s)} ${n(p.y - H * 0.36)} ` +
          `${n(p.x - 1.5 * p.s)} ${n(p.y - H * 0.6)} L ${n(p.x + 1.5 * p.s)} ${n(p.y - H * 0.6)} ` +
          `Q ${n(p.x + 1.7 * p.s)} ${n(p.y - H * 0.36)} ${n(p.x + 3 * p.s)} ${n(p.y)} Z`
        }
        fill={p.sc}
      />
      <path
        d={`M ${n(p.x)} ${n(p.y - H * 0.46)} L ${n(p.x + 6 * p.s)} ${n(p.y - H * 0.64)}`}
        stroke={p.sc}
        strokeWidth={n(1.8 * p.s)}
        strokeLinecap="round"
      />
      <path
        d={masse.map(([dx, dy, k]) => ell(p.x + R * dx, cy + R * dy, R * k, R * k * 0.94)).join(' ')}
        fill={p.c}
      />
      <path
        d={ell(p.x + R * 0.24 * p.dir, cy - R * 0.52, R * 0.34, R * 0.24)}
        fill={p.hi}
        opacity={0.18}
      />
    </>
  );
};

/**
 * Cespuglio: CINQUE lobi con quote diverse, non una massa sola.
 *
 * Con tre ellissi concentriche un cespuglio grande veniva fuori come una
 * cupola liscia — a schermo si leggeva come una collina, non come fogliame.
 * Serve che il PROFILO SUPERIORE sia frastagliato: e' quello, non il colore,
 * a dire "foglie". I lobi hanno anche un jitter per istanza, cosi' due
 * cespugli vicini non sono lo stesso disegno a due taglie.
 */
const Cespuglio: Specie = (p) => {
  const R = 12 * p.s;
  const lobi: [number, number, number][] = [
    [-0.62, -0.28, 0.5],
    [0.64, -0.24, 0.46],
    [-0.24, -0.6, 0.58],
    [0.3, -0.66, 0.5],
    [0.02, -0.32, 0.64],
  ];
  return (
    <>
      <path
        d={lobi
          .map(([dx, dy, k], i) => {
            const j = 0.86 + p.r(i + 1) * 0.28;
            return ell(p.x + R * dx * j, p.y + R * dy * j, R * k * j, R * k * j * 0.84);
          })
          .join(' ')}
        fill={p.c}
      />
      <path
        d={ell(p.x + R * 0.2 * p.dir, p.y - R * 0.98, R * 0.28, R * 0.15)}
        fill={p.hi}
        opacity={0.22}
      />
    </>
  );
};

/**
 * Felce: SETTE lame sottili a raggiera, separate una dall'altra.
 *
 * Con cinque lenti larghe le fronde si sovrapponevano fino a saldarsi, e il
 * risultato era una cupola liscia: a schermo si leggeva come una collinetta
 * chiara, non come una pianta. Una felce si riconosce dai VUOTI fra le
 * fronde, non dalla massa — quindi lame strette, e la nervatura scura che
 * marca la separazione anche dove due si toccano.
 */
const Felce: Specie = (p) => {
  const H = 21 * p.s;
  const N = 7;
  const corpo: string[] = [];
  const nervi: string[] = [];
  for (let i = 0; i < N; i++) {
    const a = ((i - (N - 1) / 2) / ((N - 1) / 2)) * 1.16;
    const L = H * (1.06 - Math.abs(a) * 0.2);
    const tx = p.x + Math.sin(a) * L;
    const ty = p.y - Math.cos(a) * L;
    corpo.push(lente(p.x + Math.sin(a) * 2 * p.s, p.y - 1.2 * p.s, tx, ty, 0.1));
    nervi.push(`M ${n(p.x)} ${n(p.y)} L ${n(tx)} ${n(ty)}`);
  }
  return (
    <>
      <path d={corpo.join(' ')} fill={p.c} />
      <path d={nervi.join(' ')} stroke={p.sc} strokeWidth={n(0.6 * p.s)} opacity={0.32} fill="none" />
    </>
  );
};

/** Ceppo tagliato: il cilindro e gli anelli sulla faccia superiore. */
const Ceppo: Specie = (p) => {
  const w = 8 * p.s;
  const h = 10.5 * p.s;
  return (
    <>
      <path
        d={
          `M ${n(p.x - w)} ${n(p.y)} L ${n(p.x - w * 0.86)} ${n(p.y - h)} ` +
          `L ${n(p.x + w * 0.86)} ${n(p.y - h)} L ${n(p.x + w)} ${n(p.y)} Z`
        }
        fill={p.sc}
      />
      <path d={ell(p.x, p.y - h, w * 0.86, w * 0.36)} fill={p.hi} opacity={0.5} />
      <path
        d={ell(p.x, p.y - h, w * 0.48, w * 0.2)}
        fill="none"
        stroke={p.sc}
        strokeWidth={n(0.8 * p.s)}
        opacity={0.45}
      />
    </>
  );
};

/**
 * Tronco caduto: sta SDRAIATO. E' l'elemento che piu' di ogni altro dice
 * "qui c'e' un pavimento", perche' un cilindro orizzontale ha senso solo se
 * appoggia su qualcosa.
 */
const TroncoCaduto: Specie = (p) => {
  const L = 28 * p.s;
  const r = 4.2 * p.s;
  // Il centro sta quasi un raggio sopra la base, cosi' il cilindro APPOGGIA
  // sul suolo invece di esserci mezzo dentro.
  const cy = p.y - r * 0.9;
  const xa = p.x - L / 2;
  const xb = p.x + L / 2;
  /** La faccia tagliata guarda verso il sentiero: e' la parte che si vede. */
  const taglio = p.dir === 1 ? xb : xa;

  return (
    <>
      <path
        d={
          `M ${n(xa)} ${n(cy - r)} L ${n(xb)} ${n(cy - r)} ` +
          `a ${n(r * 0.55)} ${n(r)} 0 0 1 0 ${n(r * 2)} ` +
          `L ${n(xa)} ${n(cy + r)} a ${n(r * 0.55)} ${n(r)} 0 0 1 0 ${n(-r * 2)} Z`
        }
        fill={p.sc}
      />
      <path d={ell(taglio, cy, r * 0.55, r)} fill={p.hi} opacity={0.34} />
      {/* Muschio sul dorso: dice da che parte arriva la luce. */}
      <path d={ell(p.x - L * 0.1 * p.dir, cy - r * 0.6, r * 1.6, r * 0.4)} fill={p.c} opacity={0.8} />
    </>
  );
};

/** Funghi: due cappelli di taglia diversa, gli unici colori vivi del bosco. */
const Fungo: Specie = (p) => {
  const H = 11 * p.s;
  const cappello = (dx: number, k: number, key: number) => {
    const cx = p.x + dx;
    return (
      <g key={key}>
        <path
          d={
            `M ${n(cx - 1.5 * p.s * k)} ${n(p.y)} L ${n(cx - 1.1 * p.s * k)} ${n(p.y - H * 0.52 * k)} ` +
            `L ${n(cx + 1.1 * p.s * k)} ${n(p.y - H * 0.52 * k)} L ${n(cx + 1.5 * p.s * k)} ${n(p.y)} Z`
          }
          fill="#F0E4CB"
        />
        <path
          d={`M ${n(cx - H * 0.6 * k)} ${n(p.y - H * 0.5 * k)} a ${n(H * 0.6 * k)} ${n(H * 0.56 * k)} 0 0 1 ${n(H * 1.2 * k)} 0 Z`}
          fill="#B44A3C"
        />
        <path d={ell(cx, p.y - H * 0.5 * k, H * 0.6 * k, H * 0.09 * k)} fill="#84332B" opacity={0.34} />
        <circle cx={n(cx - H * 0.2 * k)} cy={n(p.y - H * 0.76 * k)} r={n(H * 0.1 * k)} fill="#FFF3E0" opacity={0.9} />
        <circle cx={n(cx + H * 0.24 * k)} cy={n(p.y - H * 0.68 * k)} r={n(H * 0.08 * k)} fill="#FFF3E0" opacity={0.9} />
      </g>
    );
  };
  return (
    <>
      {cappello(0, 1, 1)}
      {cappello(5.5 * p.s * p.dir, 0.62, 2)}
    </>
  );
};

/**
 * Lucciole SOPRA UN CESPUGLIO.
 *
 * Le lucciole galleggiano davvero, ma un puntino luminoso in mezzo al nulla
 * resta un adesivo. Dandogli sotto la macchia scura da cui si alzano, il
 * gruppo diventa una scena: il cespuglio poggia, e le luci gli stanno sopra.
 */
const Lucciole: Specie = (p) => {
  const R = 11 * p.s;
  const luci: ReactNode[] = [];
  for (let i = 0; i < 6; i++) {
    const fx = n(p.x + (p.r(i + 2) - 0.5) * R * 2.4);
    const fy = n(p.y - R * 0.7 - p.r(i + 12) * R * 2.6);
    luci.push(
      <g key={i}>
        <circle cx={fx} cy={fy} r={n(3.6 * p.s)} fill="#FDE68A" opacity={0.16} />
        <circle cx={fx} cy={fy} r={n(1.15 * p.s)} fill="#FDE68A" />
      </g>
    );
  }
  return (
    <>
      <path
        d={
          ell(p.x, p.y - R * 0.34, R * 0.86, R * 0.46) +
          ell(p.x - R * 0.6, p.y - R * 0.2, R * 0.5, R * 0.32) +
          ell(p.x + R * 0.58, p.y - R * 0.24, R * 0.46, R * 0.3)
        }
        fill={p.sc}
      />
      {luci}
    </>
  );
};

/**
 * Occhi nel folto: NON due ellissi sospese, ma un cespuglio scuro con dentro
 * due occhi. Cosi' si capisce che qualcosa e' nascosto li' dentro.
 */
const OcchiNelFolto: Specie = (p) => {
  const R = 13 * p.s;
  const oy = p.y - R * 0.62;
  return (
    <>
      <path
        d={ell(p.x, p.y - R * 0.46, R, R * 0.6) + ell(p.x - R * 0.6, p.y - R * 0.28, R * 0.55, R * 0.4)}
        fill={p.sc}
      />
      <ellipse cx={n(p.x - 3.2 * p.s)} cy={n(oy)} rx={n(1.8 * p.s)} ry={n(1.4 * p.s)} fill="#FCD34D" />
      <ellipse cx={n(p.x + 3.2 * p.s)} cy={n(oy)} rx={n(1.8 * p.s)} ry={n(1.4 * p.s)} fill="#FCD34D" />
      <ellipse cx={n(p.x - 3.2 * p.s)} cy={n(oy)} rx={n(0.6 * p.s)} ry={n(1.2 * p.s)} fill="#20130A" />
      <ellipse cx={n(p.x + 3.2 * p.s)} cy={n(oy)} rx={n(0.6 * p.s)} ry={n(1.2 * p.s)} fill="#20130A" />
    </>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  PALUDE — mondo Coccodrillo
//
//  Qui vale una regola in piu': si deve leggere come ACQUA FERMA, non come
//  prato scuro. Da qui le increspature concentriche sotto ogni cosa che sta a
//  galla, la lenticchia d'acqua e i tronchi mezzi affondati.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Ninfee: un gruppetto di foglie con la TACCA a cuneo, non ellissi lisce.
 *
 * La tacca e' quello che le rende riconoscibili a colpo d'occhio. E' fatta con
 * UN SOLO arco: dal centro al bordo, giro lungo dell'ellisse, ritorno al
 * centro. Cosi' non serve ritagliare niente col colore del fondale, che qui
 * sarebbe impossibile visto che il fondale e' un degrade' continuo.
 */
const Ninfea: Specie = (p) => {
  const R = 13 * p.s;
  const verso = p.dir === 1 ? 0 : Math.PI;
  const CUNEO = 0.34;

  const foglia = (cx: number, cy: number, k: number, key: number) => {
    const rx = R * k;
    const ry = R * k * 0.4;
    return (
      <g key={key}>
        <path d={ell(cx, cy + ry * 0.75, rx * 0.98, ry * 0.8)} fill={NERO} opacity={0.1} />
        <path
          d={
            `M ${n(cx)} ${n(cy)} L ${suEllisse(cx, cy, rx, ry, verso + CUNEO)} ` +
            `A ${n(rx)} ${n(ry)} 0 1 1 ${suEllisse(cx, cy, rx, ry, verso - CUNEO)} Z`
          }
          fill={p.c}
        />
        <path
          d={[-0.8, 0, 0.8]
            .map((d) => `M ${n(cx)} ${n(cy)} L ${suEllisse(cx, cy, rx * 0.78, ry * 0.78, verso + Math.PI + d)}`)
            .join(' ')}
          stroke={p.hi}
          strokeWidth={n(0.8 * p.s)}
          opacity={0.26}
          fill="none"
        />
      </g>
    );
  };

  return (
    <>
      {foglia(p.x, p.y, 1, 1)}
      {foglia(p.x + R * 0.9 * p.dir, p.y + R * 0.22, 0.58, 2)}
      {foglia(p.x - R * 0.7 * p.dir, p.y + R * 0.32, 0.44, 3)}
    </>
  );
};

/** Fiore di loto: petali a raggiera e cuore dorato. La nota di colore. */
const Loto: Specie = (p) => {
  const R = 10 * p.s;
  const petali: ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.42;
    const cx = p.x + Math.cos(a) * R * 0.46;
    const cy = p.y - R * 0.34 + Math.sin(a) * R * 0.46;
    petali.push(
      <ellipse
        key={i}
        cx={n(cx)}
        cy={n(cy)}
        rx={n(R * 0.5)}
        ry={n(R * 0.21)}
        fill={i % 2 === 0 ? '#E9BCCB' : '#F4DBE3'}
        transform={`rotate(${n((a * 180) / Math.PI)} ${n(cx)} ${n(cy)})`}
      />
    );
  }
  return (
    <>
      <path d={ell(p.x, p.y, R, R * 0.34)} fill={p.c} />
      {petali}
      <circle cx={n(p.x)} cy={n(p.y - R * 0.34)} r={n(R * 0.19)} fill="#E3BC55" />
    </>
  );
};

/** Palma di palude: fusto inclinato verso la luce e sei fronde piene. */
const Palma: Specie = (p) => {
  const H = 38 * p.s;
  const cx = p.x + 4 * p.s * p.dir;
  const cy = p.y - H * 0.56;
  const fronde: string[] = [];
  const nervi: string[] = [];

  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.5;
    const tx = cx + Math.cos(a) * H * 0.62;
    const ty = cy + Math.sin(a) * H * 0.62;
    fronde.push(lente(cx, cy, tx, ty, 0.19));
    nervi.push(`M ${n(cx)} ${n(cy)} L ${n(tx)} ${n(ty)}`);
  }

  return (
    <>
      <path
        d={
          `M ${n(p.x - 2.8 * p.s)} ${n(p.y)} Q ${n(p.x - 1 * p.s)} ${n(p.y - H * 0.3)} ` +
          `${n(cx - 1.7 * p.s)} ${n(cy)} L ${n(cx + 1.7 * p.s)} ${n(cy)} ` +
          `Q ${n(p.x + 2 * p.s)} ${n(p.y - H * 0.3)} ${n(p.x + 2.8 * p.s)} ${n(p.y)} Z`
        }
        fill={p.sc}
      />
      <path d={fronde.join(' ')} fill={p.c} />
      <path d={nervi.join(' ')} stroke={p.hi} strokeWidth={n(0.7 * p.s)} opacity={0.2} fill="none" />
      <path d={ell(cx, cy - 1 * p.s, 2.4 * p.s, 1.8 * p.s)} fill={p.sc} />
    </>
  );
};

/**
 * Cipresso calvo: contrafforti alla base, "ginocchia" che spuntano dall'acqua
 * tutto intorno, chioma in tre masse e barbe di muschio.
 *
 * Le ginocchia sono la ragione per cui questo si legge come un albero DENTRO
 * l'acqua e non come un albero incollato sopra.
 */
const Cipresso: Specie = (p) => {
  const H = 60 * p.s;
  const W = 18 * p.s;
  const ginocchia: string[] = [];
  const barbe: string[] = [];

  for (let i = 0; i < 3; i++) {
    const gx = p.x + (i - 1) * W * 0.66 + (p.r(i + 4) - 0.5) * 4 * p.s;
    const gh = (4 + p.r(i + 14) * 4) * p.s;
    ginocchia.push(
      `M ${n(gx - gh * 0.6)} ${n(p.y)} Q ${n(gx)} ${n(p.y - gh * 1.6)} ${n(gx + gh * 0.6)} ${n(p.y)} Z`
    );
  }

  for (let i = 0; i < 4; i++) {
    const bx = p.x + (i - 1.5) * W * 0.36;
    const by = p.y - H * (0.56 + p.r(i + 5) * 0.2);
    const L = (8 + p.r(i + 15) * 12) * p.s;
    barbe.push(`M ${n(bx)} ${n(by)} q ${n(2 * p.s)} ${n(L * 0.55)} ${n(-1.4 * p.s)} ${n(L)}`);
  }

  return (
    <>
      <path
        d={
          `M ${n(p.x - W * 0.52)} ${n(p.y)} Q ${n(p.x - W * 0.17)} ${n(p.y - H * 0.2)} ` +
          `${n(p.x - W * 0.11)} ${n(p.y - H * 0.6)} L ${n(p.x + W * 0.11)} ${n(p.y - H * 0.6)} ` +
          `Q ${n(p.x + W * 0.17)} ${n(p.y - H * 0.2)} ${n(p.x + W * 0.52)} ${n(p.y)} Z`
        }
        fill={p.sc}
      />
      <path d={ginocchia.join(' ')} fill={p.sc} />
      <path
        d={
          ell(p.x - W * 0.26, p.y - H * 0.68, W * 0.6, W * 0.42) +
          ell(p.x + W * 0.24, p.y - H * 0.8, W * 0.66, W * 0.46) +
          ell(p.x - W * 0.02, p.y - H * 0.93, W * 0.52, W * 0.36)
        }
        fill={p.c}
      />
      <path
        d={barbe.join(' ')}
        fill="none"
        stroke={p.c}
        strokeWidth={n(1.5 * p.s)}
        strokeLinecap="round"
        opacity={0.55}
      />
    </>
  );
};

/** Canneto: steli affusolati in ciuffo stretto, qualcuno con la tifa. */
const Canneto: Specie = (p) => {
  const steli: string[] = [];
  const tife: ReactNode[] = [];

  for (let i = 0; i < 6; i++) {
    const cx = p.x + (i - 2.5) * 4.6 * p.s;
    const H = (24 + p.r(i + 11) * 24) * p.s;
    const cima = cx + (p.r(i + 21) - 0.5) * 7 * p.s;
    steli.push(
      `M ${n(cx - 1.5 * p.s)} ${n(p.y)} Q ${n(cx - 0.7 * p.s)} ${n(p.y - H * 0.6)} ${n(cima)} ${n(p.y - H)} ` +
        `Q ${n(cx + 0.9 * p.s)} ${n(p.y - H * 0.6)} ${n(cx + 1.5 * p.s)} ${n(p.y)} Z`
    );
    if (p.r(i + 31) > 0.5) {
      tife.push(
        <rect
          key={i}
          x={n(cima - 2.1 * p.s)}
          y={n(p.y - H - 1.5 * p.s)}
          width={n(4.2 * p.s)}
          height={n(10 * p.s)}
          rx={n(2.1 * p.s)}
          fill={p.sc}
        />
      );
    }
  }

  return (
    <>
      <path d={steli.join(' ')} fill={p.c} />
      {tife}
    </>
  );
};

/**
 * Canna con libellula POSATA.
 *
 * La libellula da sola era una delle sagome sospese peggio leggibili. Posata
 * in cima a una canna diventa un dettaglio che si nota e che ha un motivo di
 * stare li'.
 */
const LibellulaSuCanna: Specie = (p) => {
  const H = 30 * p.s;
  const cima = p.y - H;
  const L = 11 * p.s;
  const ali: readonly (readonly [number, number, number])[] = [
    [-0.22, -0.26, -18],
    [0.22, -0.26, 18],
    [-0.3, 0.18, -8],
    [0.3, 0.18, 8],
  ];
  return (
    <>
      <path
        d={
          `M ${n(p.x - 1.6 * p.s)} ${n(p.y)} Q ${n(p.x - 0.8 * p.s)} ${n(p.y - H * 0.6)} ${n(p.x)} ${n(cima)} ` +
          `Q ${n(p.x + 1 * p.s)} ${n(p.y - H * 0.6)} ${n(p.x + 1.6 * p.s)} ${n(p.y)} Z`
        }
        fill={p.c}
      />
      {ali.map(([dx, dy, rot], i) => {
        const cx = p.x + L * dx;
        const cy = cima - L * 0.2 + L * dy;
        return (
          <ellipse
            key={i}
            cx={n(cx)}
            cy={n(cy)}
            rx={n(L * 0.44)}
            ry={n(L * 0.11)}
            fill="#CDEBF7"
            opacity={i < 2 ? 0.72 : 0.5}
            transform={`rotate(${rot} ${n(cx)} ${n(cy)})`}
          />
        );
      })}
      <rect
        x={n(p.x - L * 0.5)}
        y={n(cima - L * 0.27)}
        width={n(L)}
        height={n(L * 0.14)}
        rx={n(L * 0.07)}
        fill={p.sc}
      />
      <circle cx={n(p.x - L * 0.5)} cy={n(cima - L * 0.2)} r={n(L * 0.13)} fill={p.sc} />
    </>
  );
};

/** Mangrovia: le radici ad arco che escono dall'acqua e reggono il tronco. */
const Mangrovia: Specie = (p) => {
  // Altezza e apertura variano per istanza: senza, quattro mangrovie in
  // colonna erano lo stesso identico disegno e si notava subito.
  const H = (34 + p.r(1) * 12) * p.s;
  const W = (16 + p.r(2) * 6) * p.s;
  const radici: string[] = [];
  for (let i = -2; i <= 2; i++) {
    const rx = p.x + (i / 2) * W * (0.82 + p.r(i + 5) * 0.36);
    radici.push(
      `M ${n(rx)} ${n(p.y)} Q ${n((rx + p.x) / 2)} ${n(p.y - H * 0.3)} ${n(p.x)} ${n(p.y - H * 0.44)}`
    );
  }
  return (
    <>
      <path
        d={radici.join(' ')}
        fill="none"
        stroke={p.sc}
        strokeWidth={n(2.6 * p.s)}
        strokeLinecap="round"
      />
      <path
        d={
          `M ${n(p.x - 2.6 * p.s)} ${n(p.y - H * 0.42)} L ${n(p.x - 2 * p.s)} ${n(p.y - H * 0.66)} ` +
          `L ${n(p.x + 2 * p.s)} ${n(p.y - H * 0.66)} L ${n(p.x + 2.6 * p.s)} ${n(p.y - H * 0.42)} Z`
        }
        fill={p.sc}
      />
      <path
        d={
          ell(p.x - W * (0.16 + p.r(3) * 0.16), p.y - H * 0.76, W * 0.54, W * 0.34) +
          ell(p.x + W * (0.18 + p.r(4) * 0.16), p.y - H * (0.82 + p.r(6) * 0.1), W * 0.48, W * 0.32) +
          ell(p.x, p.y - H * 0.95, W * (0.3 + p.r(7) * 0.14), W * 0.26)
        }
        fill={p.c}
      />
    </>
  );
};

/** Tronco mezzo affondato: la parte fuori dall'acqua, e l'onda che lo circonda. */
const TroncoSommerso: Specie = (p) => {
  const L = 30 * p.s;
  const r = 3.8 * p.s;
  const d = p.dir;
  return (
    <>
      <path
        d={
          `M ${n(p.x - L / 2)} ${n(p.y)} L ${n(p.x - L / 2)} ${n(p.y - r * 0.6)} ` +
          `Q ${n(p.x)} ${n(p.y - r * 2.2)} ${n(p.x + L / 2)} ${n(p.y - r * 0.9)} ` +
          `L ${n(p.x + L / 2)} ${n(p.y)} Z`
        }
        fill={p.sc}
      />
      <path
        d={`M ${n(p.x - L * 0.3)} ${n(p.y - r * 1.15)} Q ${n(p.x)} ${n(p.y - r * 1.85)} ${n(p.x + L * 0.32)} ${n(p.y - r * 1.15)}`}
        fill="none"
        stroke={p.hi}
        strokeWidth={n(0.9 * p.s)}
        opacity={0.24}
      />
      <path d={ell(p.x + L * 0.24 * d, p.y - r * 1.9, r * 1.1, r * 0.5)} fill={p.c} opacity={0.85} />
    </>
  );
};

/** Lenticchia d'acqua: una spolverata di puntini a galla. Riempie senza pesare. */
const Lenticchia: Specie = (p) => {
  const R = 16 * p.s;
  const grani: string[] = [];
  for (let i = 0; i < 14; i++) {
    grani.push(
      ell(
        p.x + (p.r(i + 1) - 0.5) * R * 2.2,
        p.y + (p.r(i + 11) - 0.5) * R * 0.6,
        1.5 * p.s,
        0.85 * p.s
      )
    );
  }
  return <path d={grani.join(' ')} fill={p.hi} opacity={0.42} />;
};

/** Il coccodrillo a pelo d'acqua: dorso e occhi. Le onde le mette la struttura. */
const OcchiSullAcqua: Specie = (p) => (
  <>
    <path
      d={
        ell(p.x, p.y + 2 * p.s, 13 * p.s, 2.4 * p.s) +
        ell(p.x - 4 * p.s, p.y, 2.2 * p.s, 1.9 * p.s) +
        ell(p.x + 4 * p.s, p.y, 2.2 * p.s, 1.9 * p.s)
      }
      fill={p.sc}
    />
    <circle cx={n(p.x - 4 * p.s)} cy={n(p.y - 0.3 * p.s)} r={n(1.4 * p.s)} fill="#F7C948" />
    <circle cx={n(p.x + 4 * p.s)} cy={n(p.y - 0.3 * p.s)} r={n(1.4 * p.s)} fill="#F7C948" />
    <ellipse cx={n(p.x - 4 * p.s)} cy={n(p.y - 0.3 * p.s)} rx={n(0.5 * p.s)} ry={n(1.2 * p.s)} fill="#14231A" />
    <ellipse cx={n(p.x + 4 * p.s)} cy={n(p.y - 0.3 * p.s)} rx={n(0.5 * p.s)} ry={n(1.2 * p.s)} fill="#14231A" />
  </>
);

// ════════════════════════════════════════════════════════════════════════════
//  CATALOGO PER BIOMA
// ════════════════════════════════════════════════════════════════════════════

/**
 * La FRANGIA e' la fila fitta di ciuffi che corre lungo il ciglio.
 *
 * Serve a non far finire il terreno con una linea netta: un bordo pulito
 * sembra un ritaglio di carta, un bordo sfrangiato sembra vegetazione. E'
 * disegnata come UN SOLO path per gradino e per lato, quindi costa quasi
 * niente anche se contiene un centinaio di ciuffi.
 */
type Frangia = 'ciuffo' | 'gobba' | 'canna';

/** Come e' fatto il suolo: cambia solo il trattamento del dosso. */
type Suolo = 'roccia' | 'terra' | 'melma';

interface Bioma {
  voci: readonly Voce[];
  frangia: Frangia;
  suolo: Suolo;
}

const BIOMI: Record<string, Bioma> = {
  delfino: {
    frangia: 'gobba',
    suolo: 'roccia',
    voci: [
      { disegna: Alga, largo: 18, peso: 3 },
      { disegna: Corallo, largo: 16, peso: 2.2 },
      { disegna: Roccia, largo: 19, peso: 2.2 },
      { disegna: Spugna, largo: 12, peso: 1.6 },
      { disegna: Erba, largo: 14, peso: 2.2 },
      { disegna: Ciottoli, largo: 18, peso: 1.6 },
      { disegna: Stella, largo: 11, peso: 1.1, passi: [1, 2] },
      { disegna: Anemone, largo: 17, peso: 1.3 },
      { disegna: Fumarola, largo: 14, peso: 1.2, a: 0.9 },
      { disegna: Pesci, largo: 20, peso: 1.6, posa: 'volo', da: 0.15 },
      { disegna: Medusa, largo: 11, peso: 1.2, posa: 'volo', da: 0.45 },
    ],
  },
  cerbiatto: {
    frangia: 'ciuffo',
    suolo: 'terra',
    voci: [
      { disegna: Abete, largo: 12.5, peso: 3 },
      { disegna: Latifoglia, largo: 20, peso: 2.3 },
      { disegna: Cespuglio, largo: 16, peso: 2 },
      { disegna: Felce, largo: 18, peso: 1.8 },
      { disegna: Erba, largo: 14, peso: 2.2 },
      { disegna: Ciottoli, largo: 18, peso: 1.3 },
      { disegna: Ceppo, largo: 9, peso: 1, passi: [1, 2] },
      { disegna: TroncoCaduto, largo: 16, peso: 1.2, passi: [1, 2] },
      { disegna: Roccia, largo: 19, peso: 1.1 },
      { disegna: Fungo, largo: 10, peso: 1, da: 0.18, a: 0.82, passi: [2] },
      { disegna: Lucciole, largo: 17, peso: 1.4, da: 0.36 },
      { disegna: OcchiNelFolto, largo: 15, peso: 1, da: 0.68, passi: [1, 2] },
    ],
  },
  coccodrillo: {
    frangia: 'canna',
    suolo: 'melma',
    voci: [
      { disegna: Ninfea, largo: 20, peso: 2.4, posa: 'acqua' },
      { disegna: Palma, largo: 26, peso: 2 },
      { disegna: Cipresso, largo: 17, peso: 2.2 },
      { disegna: Canneto, largo: 17, peso: 2 },
      { disegna: Erba, largo: 14, peso: 1.8 },
      { disegna: Mangrovia, largo: 21, peso: 1.6 },
      { disegna: TroncoSommerso, largo: 16, peso: 1.2, posa: 'acqua', passi: [1, 2] },
      { disegna: Lenticchia, largo: 19, peso: 1.3, posa: 'acqua' },
      { disegna: Loto, largo: 11, peso: 1, posa: 'acqua', a: 0.74, passi: [2] },
      { disegna: LibellulaSuCanna, largo: 9, peso: 1.1, a: 0.7 },
      { disegna: OcchiSullAcqua, largo: 15, peso: 1.2, posa: 'acqua', da: 0.5, passi: [1, 2] },
    ],
  },
};

/** Estrae una voce ammessa a profondita' `t` nella passata `passo`, coi pesi del catalogo. */
function scegli(voci: readonly Voce[], t: number, passo: number, r: number): Voce {
  const ammesse = voci.filter(
    (v) => t >= (v.da ?? 0) && t <= (v.a ?? 1) && (v.passi === undefined || v.passi.includes(passo))
  );
  const lista = ammesse.length > 0 ? ammesse : voci;
  const totale = lista.reduce((sum, v) => sum + (v.peso ?? 1), 0);
  let acc = r * totale;
  for (const v of lista) {
    acc -= v.peso ?? 1;
    if (acc <= 0) return v;
  }
  return lista[lista.length - 1];
}

// ════════════════════════════════════════════════════════════════════════════
//  FRANGIA E CHIAZZE: due path per gradino, non centinaia di elementi
// ════════════════════════════════════════════════════════════════════════════

/** Una singola matassa di frangia, come dato di path. */
function ciuffo(x: number, y: number, k: number, lato: 1 | -1, tipo: Frangia, r: number): string {
  const d = lato;
  if (tipo === 'gobba') {
    // Sassolini a GRUPPI di uno o due, con larghezza e altezza slegate fra
    // loro. Una gobba sola sempre uguale, ripetuta lungo duemila pixel, si
    // legge come una zip cucita sul bordo: e' quello che si vedeva prima.
    const uno = (cx: number, w: number, alto: number) =>
      `M ${n(cx - w)} ${n(y)} a ${n(w)} ${n(w * alto)} 0 0 1 ${n(w * 2)} 0 Z`;
    const w = 4.4 * k;
    const sassi = [uno(x, w, 0.34 + r * 0.9)];
    if (r > 0.52) {
      const w2 = w * (0.45 + r * 0.35);
      sassi.push(uno(x + (w + w2 * 0.85) * d * (r > 0.82 ? -1 : 1), w2, 0.4 + r * 0.7));
    }
    return sassi.join(' ');
  }
  const alto = tipo === 'canna' ? 12 : 8;
  const lame: string[] = [];
  const N = tipo === 'canna' ? 3 : 4;
  for (let i = 0; i < N; i++) {
    const bx = x + (i - (N - 1) / 2) * 2.2 * k * d;
    const h = alto * k * (0.6 + ((i * 7 + r * 31) % 10) / 10);
    // Inclinazione contenuta: la frangia deve AFFACCIARSI sul ciglio, non
    // sporgere a mensola. Oltre un terzo dell'altezza tornerebbe a sembrare
    // vegetazione appesa nel vuoto.
    const pend = (0.1 + r * 0.28) * h * d;
    lame.push(
      `M ${n(bx - 1.05 * k)} ${n(y)} Q ${n(bx + pend * 0.3)} ${n(y - h * 0.6)} ${n(bx + pend)} ${n(y - h)} ` +
        `Q ${n(bx + pend * 0.1)} ${n(y - h * 0.5)} ${n(bx + 1.05 * k)} ${n(y)} Z`
    );
  }
  return lame.join(' ');
}

/** Tutta la frangia di un gradino in un unico `d`. */
function frangiaPath(
  w: Larghezza,
  lato: 1 | -1,
  totalH: number,
  vbW: number,
  sale: number,
  tipo: Frangia,
  scala: number
): string {
  const PASSO = 26;
  const N = Math.floor(totalH / PASSO);
  const out: string[] = [];
  for (let i = 0; i <= N; i++) {
    // Una matassa su sei salta: un filo continuo lungo tutto il ciglio si
    // legge come una decorazione applicata, un filo interrotto come
    // vegetazione cresciuta li'.
    if (seeded(i, sale + 17) < 0.17) continue;
    const y = (i + 0.5) * PASSO + (seeded(i, sale) - 0.5) * PASSO * 0.8;
    if (y < 0 || y > totalH) continue;
    const ins = w(y);
    const dentro = 2 + seeded(i, sale + 5) * 7;
    const x = lato === 1 ? ins - dentro : vbW - ins + dentro;
    const k = scala * (0.5 + seeded(i, sale + 7) * 1.05);
    out.push(ciuffo(x, y, k, lato, tipo, seeded(i, sale + 13)));
  }
  return out.join(' ');
}

/** Chiazze DENTRO un gradino: tolgono la sensazione di tinta piatta. */
function chiazzePath(
  w: Larghezza,
  lato: 1 | -1,
  totalH: number,
  vbW: number,
  sale: number
): string {
  const PASSO = 29;
  const N = Math.floor(totalH / PASSO);
  const out: string[] = [];
  for (let i = 0; i <= N; i++) {
    const y = (i + 0.5) * PASSO + (seeded(i, sale + 2) - 0.5) * PASSO * 0.8;
    if (y < 0 || y > totalH) continue;
    const q = 0.14 + seeded(i, sale + 4) * 0.64;
    const ins = w(y) * q;
    const x = lato === 1 ? ins : vbW - ins;
    const rx = (2.4 + seeded(i, sale + 6) * 6) * (0.5 + q);
    out.push(ell(x, y, rx, rx * (0.3 + seeded(i, sale + 8) * 0.16)));
  }
  return out.join(' ');
}

/**
 * FONDO DEL CORRIDOIO: quel poco che serve perche' non sia una tinta piatta.
 *
 * Il centro della mappa deve restare LIBERO — ci passano sentiero, nodi,
 * soglie ed etichette — ma completamente liscio si legge come uno sfondo vuoto
 * invece che come un luogo. Qui ci va l'unica cosa che non puo' mai sembrare
 * appiccicata: macchie larghissime, senza contorno e sotto ogni soglia di
 * dettaglio. Nell'acqua sono increspature (ellissi schiacciate, solo il
 * profilo), a terra sono pozze di luce filtrata dalle chiome.
 *
 * Sta DIETRO a tutto e la sua opacita' sta fra il 5 e il 7 per cento: se si
 * nota come oggetto, e' gia' troppo.
 */
function fondoPath(totalH: number, vbW: number, acqua: boolean): string {
  const PASSO = 92;
  const N = Math.floor(totalH / PASSO);
  const out: string[] = [];
  for (let i = 0; i <= N; i++) {
    const y = (i + 0.5) * PASSO + (seeded(i, 71) - 0.5) * PASSO * 0.8;
    if (y < 24 || y > totalH - 24) continue;
    const cx = (0.3 + seeded(i, 73) * 0.4) * vbW;
    const rx = (0.16 + seeded(i, 79) * 0.2) * vbW;
    out.push(ell(cx, y, rx, rx * (acqua ? 0.08 : 0.32)));
  }
  return out.join(' ');
}

// ════════════════════════════════════════════════════════════════════════════
//  LE TRE PASSATE DI VEGETAZIONE
// ════════════════════════════════════════════════════════════════════════════

interface Passata {
  /** Su quale gradino poggia. */
  su: 'cresta' | 'riva';
  /**
   * Dove cade la base dentro la fascia UTILE, in frazione: 0 = tutta verso il
   * bordo della mappa, 1 = con l'ingombro che sfiora il ciglio.
   */
  ancora: [number, number];
  /** Spinta nella rampa del suolo su cui poggia: deve pareggiare il gradino. */
  suoloSpinta: number;
  suoloVelo: number;
  /** Spinta della VEGETAZIONE: minore di quella del suolo, cosi' si stacca. */
  spinta: number;
  velo: number;
  opacita: number;
  scala: number;
  /** Elementi per fascia e per lato: [in superficie, in profondita']. */
  quantita: [number, number];
  /** Sfasamento verticale delle caselle, cosi' le passate non si incolonnano. */
  fase: number;
}

/**
 * LO SCARTO FRA `suoloSpinta` E `spinta` E' IL CONTRASTO DELLA SCENA.
 *
 * Vale sedici centesimi di rampa in tutte e tre le passate, ed e' il motivo
 * per cui le sagome si vedono. Nella versione precedente lo scarto era quasi
 * nullo e gli alberi sparivano dentro la sponda: si vedevano solo i funghi,
 * che hanno un rosso fisso. Se un giorno la scena sembra di nuovo piatta, e'
 * questo numero che va guardato per primo — non i disegni delle specie.
 */
const PASSATE: readonly Passata[] = [
  // Cresta: piccolo e SCURO, come il versante in ombra su cui poggia.
  {
    su: 'cresta',
    ancora: [0.04, 0.8],
    suoloSpinta: 0.5,
    suoloVelo: 0.06,
    spinta: 0.34,
    velo: 0.12,
    opacita: 0.95,
    scala: 0.5,
    quantita: [3, 4],
    fase: -0.24,
  },
  // Riva, meta' esterna.
  {
    su: 'riva',
    ancora: [0.08, 0.6],
    suoloSpinta: 0.3,
    suoloVelo: 0,
    spinta: 0.14,
    velo: 0.06,
    opacita: 0.98,
    scala: 0.76,
    quantita: [1, 2],
    fase: 0.06,
  },
  // Primo piano: uno solo per fascia e per lato. E' quello grande, e
  // mettercene due significa per forza accavallarli.
  {
    su: 'riva',
    ancora: [0.5, 1],
    suoloSpinta: 0.3,
    suoloVelo: 0,
    spinta: 0.14,
    velo: 0,
    opacita: 1,
    scala: 1.06,
    quantita: [1, 1],
    fase: 0.32,
  },
];

// ════════════════════════════════════════════════════════════════════════════
//  IL COMPONENTE
// ════════════════════════════════════════════════════════════════════════════

function EdgeDecorBase({ world, totalH, g }: { world: WorldConfig; totalH: number; g: Geo }) {
  const bioma = BIOMI[world.id] ?? BIOMI.delfino;
  const uid = `biome-${world.id}`;

  /**
   * Il colore a profondita' `t`, spinto avanti nella rampa del mondo.
   *
   * Campionare dalla STESSA rampa del fondale e' quello che tiene insieme la
   * tavolozza: il terreno non e' mai un colore estraneo, e' sempre lo stesso
   * ambiente piu' fitto. Oltre la fine della rampa si continua a scurire verso
   * il nero-verde, altrimenti in fondo alla mappa tutto collasserebbe sullo
   * stesso identico colore e non si distinguerebbe piu' niente.
   */
  const tono = (t: number, spinta: number): string => {
    const v = t + spinta;
    if (v <= 1) return rampColor(world.gradient, v);
    // Oltre la fine della rampa si continua a scurire, ma con FRENO: portando
    // il fondo mappa quasi al nero i due gradini collassavano l'uno sull'altro
    // e nelle ultime tappe restavano due strisce piatte senza piu' terreno
    // leggibile. Il tetto tiene la scena cupa ma ancora distinguibile.
    return lerpColor(rampColor(world.gradient, 1), '#04100B', Math.min(0.44, (v - 1) * 0.62));
  };

  /** `velo` riporta il colore verso il fondale (foschia), `buio` lo affonda. */
  const tinta = (t: number, spinta: number, velo = 0, buio = 0): string => {
    let c = tono(t, spinta);
    if (buio > 0) c = lerpColor(c, '#07140E', buio);
    if (velo > 0) c = lerpColor(c, rampColor(world.gradient, t), velo);
    return c;
  };

  /** Rampa verticale di un elemento che attraversa tutta la mappa. */
  const rampa = (spinta: number, velo: number, buio: number, mix?: [string, number]) =>
    Array.from({ length: 11 }, (_, k) => {
      const p = k / 10;
      const c = tinta(easeDepth(p), spinta, velo, buio);
      return { off: p * 100, col: mix ? lerpColor(c, mix[0], mix[1]) : c };
    });

  // ── PERCHE' LA CRESTA E' PIU' SCURA DELLA RIVA ──────────────────────────
  //
  // Prima la cresta era velata verso il fondale (foschia della distanza) e sul
  // fondale CHIARO delle prime tappe finiva per risultare piu' chiara della
  // riva: il risultato era un bordo pallido lungo i due lati della mappa, cioe'
  // l'esatto contrario di un pendio. Qui il terreno si SCURISCE andando verso
  // il bordo, come un versante in ombra che sale allontanandosi dal sentiero
  // illuminato. La foschia resta, ma appena accennata.
  const GRADIENTI: [string, ReturnType<typeof rampa>][] = [
    ['cresta', rampa(0.5, 0.06, 0.16)],
    ['riva', rampa(0.3, 0, 0.08)],
    ['frangiaC', rampa(0.56, 0.06, 0.18)],
    ['frangiaR', rampa(0.33, 0, 0.12)],
    ['luce', rampa(0.04, 0, 0, ['#FFFFFF', 0.55])],
  ];

  // ─── I due gradini, lato per lato ─────────────────────────────────────────
  //
  // I profili si calcolano UNA VOLTA per lato. Li usano il riempimento, il
  // ciglio, la frangia e il piantamento della vegetazione, e devono essere
  // esattamente le stesse funzioni: se la vegetazione interrogasse un profilo
  // anche solo leggermente diverso da quello disegnato, tornerebbe a poggiare
  // sul vuoto — che e' il difetto da cui siamo partiti.

  const lati = ([1, -1] as const).map((lato) => {
    const { riva, cresta } = profiliDi(lato, g.vbW);
    return {
      lato,
      chiave: lato === 1 ? 'sx' : 'dx',
      ancora: lato === 1 ? 0 : g.vbW,
      riva,
      cresta,
    };
  });

  const terreno = lati.map(({ lato, chiave, ancora, riva, cresta }) => (
    <g key={`terreno-${chiave}`}>
      {/* OMBRA PORTATA DELLA RIVA SUL CORRIDOIO.
          Tre scalini di opacita' invece di un filtro di sfocatura, che su una
          mappa alta duemila pixel costerebbe troppo. E' il segnale che dice
          "il sentiero corre PIU' IN BASSO del terreno": senza, le due
          superfici sembrano complanari e il terreno galleggia. */}
      <path d={massa(campiona(riva, lato, totalH, g.vbW, 16), ancora, totalH)} fill={NERO} opacity={0.04} />
      <path d={massa(campiona(riva, lato, totalH, g.vbW, 8.5), ancora, totalH)} fill={NERO} opacity={0.05} />
      <path d={massa(campiona(riva, lato, totalH, g.vbW, 3), ancora, totalH)} fill={NERO} opacity={0.06} />

      {/* Il gradino basso, quello su cui poggia il primo piano. */}
      <path d={massa(campiona(riva, lato, totalH, g.vbW), ancora, totalH)} fill={`url(#${uid}-riva)`} />
      <path d={chiazzePath(riva, lato, totalH, g.vbW, 307)} fill={`url(#${uid}-luce)`} opacity={0.09} />

      {/* Ombra della cresta sulla riva: stesso principio, un gradino piu' su.
          Piu' leggera di quella verso il corridoio, perche' la cresta e' gia'
          di suo il tono piu' scuro e sommando le due cose veniva fuori una
          striscia nera netta invece di un'ombra. */}
      <path d={massa(campiona(cresta, lato, totalH, g.vbW, 9), ancora, totalH)} fill={NERO} opacity={0.035} />
      <path d={massa(campiona(cresta, lato, totalH, g.vbW, 3.5), ancora, totalH)} fill={NERO} opacity={0.04} />

      {/* Il gradino alto, contro il bordo della mappa. */}
      <path d={massa(campiona(cresta, lato, totalH, g.vbW), ancora, totalH)} fill={`url(#${uid}-cresta)`} />
      <path d={chiazzePath(cresta, lato, totalH, g.vbW, 151)} fill={`url(#${uid}-luce)`} opacity={0.07} />
      <path
        d={linea(campiona(cresta, lato, totalH, g.vbW))}
        fill="none"
        stroke={`url(#${uid}-luce)`}
        strokeWidth={1.1}
        opacity={0.2}
      />
      <path
        d={frangiaPath(cresta, lato, totalH, g.vbW, 203, bioma.frangia, 0.55)}
        fill={`url(#${uid}-frangiaC)`}
        opacity={0.75}
      />

      {/* Luce di taglio sul ciglio della riva: senza, il terreno si impasta
          nel fondale proprio dove serve che si stacchi. */}
      <path
        d={linea(campiona(riva, lato, totalH, g.vbW))}
        fill="none"
        stroke={`url(#${uid}-luce)`}
        strokeWidth={1.5}
        opacity={0.34}
      />
      <path
        d={frangiaPath(riva, lato, totalH, g.vbW, 401, bioma.frangia, 0.85)}
        fill={`url(#${uid}-frangiaR)`}
        opacity={0.82}
      />
    </g>
  ));

  // ─── La vegetazione ───────────────────────────────────────────────────────

  const fasce = Math.max(1, Math.ceil(totalH / g.band));
  const perPassata: { y: number; nodo: ReactNode }[][] = PASSATE.map(() => []);

  for (let passo = 0; passo < PASSATE.length; passo++) {
    const R = PASSATE[passo];

    for (let b = 0; b < fasce; b++) {
      const t = easeDepth(fasce <= 1 ? 0 : b / (fasce - 1));
      const y0 = b * g.band;
      const h = Math.min(g.band, totalH - y0);
      if (h <= 0) break;

      // Il suolo e' PIU' SCURO della vegetazione: e' questo, e non un contorno,
      // che fa staccare le sagome dal terreno a ogni profondita'.
      const suolo = tinta(t, R.suoloSpinta, R.suoloVelo, 0.1);
      const colDosso = lerpColor(suolo, '#FFFFFF', 0.06);
      const colOnda = lerpColor(suolo, '#FFFFFF', 0.42);
      const c = tinta(t, R.spinta, R.velo, 0.02);
      const hi = lerpColor(c, '#FFFFFF', 0.32);
      const sc = lerpColor(c, '#06120C', 0.38);
      // La pietra parte dal SUOLO, non dal fogliame, e vira al grigio: resta
      // dentro la tavolozza del bioma ma non e' piu' un colore vegetale.
      const pi = lerpColor(lerpColor(suolo, '#79808C', 0.4), '#06120C', 0.06);
      const piHi = lerpColor(pi, '#FFFFFF', 0.24);

      const quanti = Math.max(
        1,
        Math.round(R.quantita[0] + (R.quantita[1] - R.quantita[0]) * t)
      );

      for (const { lato, riva, cresta } of lati) {
        const bordo = R.su === 'cresta' ? cresta : riva;

        // La fascia si divide in tante CASELLE quanti sono gli elementi, e
        // ognuno sta nella sua. E' questo — non il caso — a garantire che due
        // elementi della stessa passata non finiscano mai uno sull'altro.
        const casella = h / quanti;

        for (let j = 0; j < quanti; j++) {
          const seme = passo * 911 + b * 37 + (lato === 1 ? 0 : 13) + j * 5;
          const r = (salt: number) => seeded(seme, salt);

          const y = y0 + casella * (j + 0.5 + R.fase) + (r(23) - 0.5) * casella * 0.34;
          if (y < 6 || y > totalH - 3) continue;

          // ── IL VINCOLO DI INGOMBRO ──────────────────────────────────────
          //
          // Qui sta la correzione principale rispetto alla versione
          // precedente. `utile` e' la larghezza di terreno disponibile a
          // QUESTA quota; la sagoma occupa `2 * largo * scala`. Se non ci
          // sta, si RIDUCE LA SCALA finche' non ci sta — non si sposta la
          // base sperando che basti. Cosi' non esiste nessuna combinazione
          // di quota, specie e casualita' che possa far sporgere qualcosa:
          // e' una disuguaglianza, non una taratura.
          //
          // AGGIUNTA IMPORTANTE: la fascia VISIBILE di un gradino non parte
          // dal bordo della mappa, parte da dove finisce il gradino disegnato
          // sopra di lui. Per la riva comincia al ciglio della cresta.
          // Piantare la vegetazione della riva da zero significava metterla
          // SOTTO la cresta, cioe' su un terreno che non e' il suo: si vedeva
          // il suo dosso, chiaro, stampato sopra la fascia scura della cresta
          // come una cupola appoggiata li'.
          const interno = R.su === 'cresta' ? 0 : cresta(y) + 2;
          const ciglio = bordo(y) - MARGINE;
          const utile = ciglio - interno;
          if (utile < 7) continue;

          const voce = scegli(bioma.voci, t, passo, r(43));

          // Il vincolo NON e' simmetrico, e non e' una svista:
          //  - verso il SENTIERO l'ingombro non puo' mai superare il ciglio,
          //    altrimenti si torna alle chiome sospese sull'acqua aperta;
          //  - verso il BORDO MAPPA una chioma della riva PUO' sconfinare
          //    sulla cresta, perche' la riva sta davanti: quello che ne esce
          //    e' un albero che copre il versante dietro, cioe' occlusione
          //    corretta e per giunta gratis.
          // Nella passata di cresta invece si vincola da tutte e due le parti:
          // sconfinare vorrebbe dire passare DAVANTI a qualcosa che e' piu'
          // vicino di lei.
          const dueLati = R.su === 'cresta';
          let scala = R.scala * (0.82 + r(31) * 0.36) * (1 + t * 0.1);
          let semi = voce.largo * scala;
          const tetto = utile * (dueLati ? 0.62 : 0.8);
          if (semi > tetto) {
            scala *= tetto / semi;
            semi = tetto;
          }
          // Sotto una certa taglia non si legge piu' niente: meglio lasciare
          // il terreno nudo che seminarlo di francobolli.
          if (scala < 0.3) continue;

          // La base sta SEMPRE dentro la fascia visibile del suo gradino.
          const xMin = interno + semi * (dueLati ? 0.5 : 0.15);
          const xMax = Math.max(xMin, ciglio - semi);
          const q = R.ancora[0] + r(11) * (R.ancora[1] - R.ancora[0]);
          const xLocale = xMin + q * (xMax - xMin);
          const x = lato === 1 ? xLocale : g.vbW - xLocale;

          const P: Pennello = { x, y, s: scala, c, hi, sc, pi, piHi, dir: lato, r };
          const posa: Posa = voce.posa ?? 'suolo';

          // Il dosso e' TERRENO, quindi - al contrario della chioma - non puo'
          // sconfinare da nessuna delle due parti: ne' oltre il ciglio verso il
          // sentiero, ne' all'indietro sulla fascia del gradino dietro. Del
          // terreno che si gonfia sopra altro terreno non esiste.
          const largoDosso = Math.max(
            semi * 0.6,
            Math.min(semi * 1.18, bordo(y) - 1 - xLocale, xLocale - interno + 2.5)
          );

          let corpo: ReactNode;
          if (posa === 'volo') {
            // Chi sta sospeso porta la SUA ombra sul fondo: e' quella a dire
            // "sto in mezz'acqua apposta" invece di "sono un adesivo".
            const alzata = Math.min(y - 8, (16 + r(53) * 20) * scala);
            corpo = (
              <>
                <path d={ell(x, y, semi * 0.7, semi * 0.19)} fill={NERO} opacity={0.11} />
                <g transform={`translate(0 ${n(-alzata)})`}>{voce.disegna(P)}</g>
              </>
            );
          } else if (posa === 'acqua') {
            corpo = (
              <>
                <path
                  d={
                    ell(x, y + 1.6 * scala, semi * 1.2, semi * 0.32) +
                    ell(x, y + 1.6 * scala, semi * 0.76, semi * 0.2)
                  }
                  fill="none"
                  stroke={colOnda}
                  strokeWidth={n(0.9 * scala)}
                  opacity={0.17}
                />
                {voce.disegna(P)}
              </>
            );
          } else {
            corpo = (
              <>
                {/* IL DOSSO: il terreno che si gonfia sotto la sagoma. E' la
                    differenza fra una pianta POSATA sul fondale e una pianta
                    che ne ESCE. */}
                <path d={dosso(x, y, largoDosso)} fill={colDosso} />
                {bioma.suolo === 'melma' && (
                  <path
                    d={ell(x, y + 1.2 * scala, largoDosso * 1.24, largoDosso * 0.3)}
                    fill="none"
                    stroke={colOnda}
                    strokeWidth={n(0.9 * scala)}
                    opacity={0.15}
                  />
                )}
                <path
                  d={ell(x, y, semi * 0.86, semi * 0.2) + ell(x, y, semi * 0.46, semi * 0.12)}
                  fill={NERO}
                  opacity={0.09}
                />
                {voce.disegna(P)}
              </>
            );
          }

          perPassata[passo].push({
            y,
            nodo: (
              <g key={`${passo}-${b}-${lato}-${j}`} opacity={R.opacita}>
                {corpo}
              </g>
            ),
          });
        }
      }
    }
  }

  // Dentro ogni passata si disegna dal piu' in ALTO al piu' in BASSO: e' la
  // regola che regge tutte le mappe a scorrimento verticale. Cio' che sta piu'
  // in basso e' piu' vicino, quindi copre; senza questo ordine due chiome che
  // si sfiorano si accavallano a caso e si vede subito.
  const disegnate = perPassata.map((lista) =>
    lista.sort((a, b) => a.y - b.y).map((e) => e.nodo)
  );

  return (
    <>
      <defs>
        {GRADIENTI.map(([nome, stops]) => (
          <linearGradient key={nome} id={`${uid}-${nome}`} x1="0" y1="0" x2="0" y2="1">
            {stops.map((s, i) => (
              <stop key={i} offset={`${s.off}%`} stopColor={s.col} />
            ))}
          </linearGradient>
        ))}
      </defs>

      {/* Il fondo del corridoio, dietro a tutto il resto. */}
      {bioma.suolo === 'terra' ? (
        <path d={fondoPath(totalH, g.vbW, false)} fill={`url(#${uid}-luce)`} opacity={0.05} />
      ) : (
        <path
          d={fondoPath(totalH, g.vbW, true)}
          fill="none"
          stroke={`url(#${uid}-luce)`}
          strokeWidth={1.1}
          opacity={0.07}
        />
      )}

      {/* L'ORDINE E' LA PROFONDITA': prima tutto il terreno, poi la
          vegetazione dalla piu' lontana alla piu' vicina. */}
      {terreno}
      {disegnate[0]}
      {disegnate[1]}
      {disegnate[2]}
    </>
  );
}

/**
 * Memoizzato: durante il cammino della mascotte `KidsPathMap` si ridisegna a
 * ogni frame, e ricostruire un migliaio di sagome sessanta volte al secondo
 * fa scattare lo scorrimento sui telefoni. Le tre prop sono riferimenti
 * stabili, quindi il confronto superficiale basta.
 */
export const EdgeDecor = memo(EdgeDecorBase);
EdgeDecor.displayName = 'EdgeDecor';
