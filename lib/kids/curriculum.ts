/**
 * ╭──────────────────────────────────────────────────────────────────────╮
 * │  PERCORSI KIDS — I 12 PASSI DEL DIARIO DEL TENNIS                     │
 * ╰──────────────────────────────────────────────────────────────────────╯
 *
 * Tre percorsi (DELFINO, CERBIATTO, COCCODRILLO), ognuno composto da
 * 12 PASSI raggruppati DUE A DUE, esattamente come nel Diario del Tennis:
 * ogni pagina del libretto = una TAPPA = due passi.
 *
 *   Tappa 1 → passi 1 e 2      Tappa 4 → passi 7 e 8
 *   Tappa 2 → passi 3 e 4      Tappa 5 → passi 9 e 10
 *   Tappa 3 → passi 5 e 6      Tappa 6 → passi 11 e 12
 *
 * REGOLA DI SBLOCCO: una tappa e' accessibile solo se la PRECEDENTE ha
 * TUTTI i suoi obiettivi spuntati. Tra una tappa e l'altra c'e' quindi una
 * catena con lucchetto (vedi components/kids/KidsPathMap.tsx).
 *
 * AVATAR: cambia ogni 4 passi, cioe' ogni 2 tappe → 3 stadi (cucciolo,
 * ragazzo, adulto), le stesse grafiche gia' presenti in
 * public/percorsi/<mondo>/<tier>.png.
 *
 * COMPLETAMENTO: finiti tutti i 12 passi l'allievo passa al livello
 * successivo (Delfino → Cerbiatto → Coccodrillo).
 *
 * ─── PERCHE' I DATI STANNO IN CODICE E NON NEL DATABASE ────────────────
 * Il contenuto dei 12 passi e' materiale didattico FIT: e' identico per
 * tutti gli allievi e cambia solo quando cambia il libretto. Tenerlo qui
 * significa: nessuna seed da rieseguire, tipizzazione forte, zero query
 * per disegnare la mappa. Sul database finiscono SOLO le spunte
 * dell'allievo (tabella `kids_path_progress`, una riga per obiettivo
 * completato).
 *
 * ─── STABILITA' DELLE CHIAVI (IMPORTANTE) ──────────────────────────────
 * Ogni obiettivo ha una `key` DERIVATA DAL TESTO (slug + hash), non dalla
 * posizione nell'array. Quindi si possono riordinare o inserire obiettivi
 * senza corrompere i progressi gia' salvati.
 * ATTENZIONE: se si MODIFICA il testo di un obiettivo la sua chiave cambia
 * e la spunta relativa risulta persa. Per correggere un refuso senza
 * perdere i dati, aggiornare anche la riga in `kids_path_progress`.
 *
 * File PURO: nessun React, nessun Supabase. Solo dati e piccole funzioni.
 */

import type { GoalCategory, PlayerLevel } from '@/lib/database.types';

// ─── Tipi ───────────────────────────────────────────────────────────────────

/** Le aree di obiettivi del Diario. */
export type KidsArea = 'mentali' | 'motori' | 'tattici' | 'tecnici' | 'insieme';

export interface KidsObjective {
  /** Identificativo stabile salvato su `kids_path_progress.objective_key`. */
  key: string;
  /** Il testo dell'obiettivo, come nel libretto. */
  title: string;
  /** Il chiarimento tra parentesi del libretto (didascalia per il maestro). */
  hint?: string;
  area: KidsArea;
}

export interface KidsAreaBlock {
  area: KidsArea;
  /** Etichetta mostrata (per "insieme" cambia tra Impariamo/Perfezioniamo). */
  label: string;
  objectives: KidsObjective[];
}

/** Una TAPPA del percorso = due passi consecutivi. */
export interface KidsStage {
  /** es. 's1_2' — usato nelle chiavi degli obiettivi. */
  id: string;
  /** I due passi che compongono la tappa, es. [1, 2]. */
  steps: [number, number];
  /** Etichetta pronta: "Passi 1 e 2". */
  label: string;
  /** Il campo su cui si gioca in questa tappa (es. "Super Delfino"). */
  court: string;
  areas: KidsAreaBlock[];
  /** Tutti gli obiettivi della tappa, in ordine di area. */
  objectives: KidsObjective[];
}

export interface KidsProgramColors {
  /** Colore dominante del percorso (le impronte del libretto). */
  accent: string;
  /** Variante scura per ombre e testi su fondo chiaro. */
  accentDark: string;
  /** Fondo tenue delle card. */
  soft: string;
  /** Colore del titolo (nel libretto e' sempre il blu). */
  ink: string;
}

export interface KidsProgram {
  level: PlayerLevel;
  /** Slug del mondo: coincide con public/percorsi/<slug>/. */
  slug: 'delfino' | 'cerbiatto' | 'coccodrillo';
  name: string;
  /** Titolo della pagina del libretto. */
  headline: string;
  /** Frase introduttiva mostrata in cima al percorso. */
  intro: string;
  emoji: string;
  colors: KidsProgramColors;
  /** Le 6 tappe (12 passi). */
  stages: KidsStage[];
}

// ─── Aspetto delle aree (riusa la palette delle categorie dell'app) ─────────

export const KIDS_AREA_CONFIG: Record<
  KidsArea,
  { label: string; category: GoalCategory; color: string; bg: string; icon: string }
> = {
  mentali: { label: 'Obiettivi mentali', category: 'mente', color: '#7B1FA2', bg: '#F3E5F5', icon: 'sparkles' },
  motori: { label: 'Obiettivi motori', category: 'fisico', color: '#2E7D32', bg: '#E8F5E9', icon: 'dumbbell' },
  tattici: { label: 'Obiettivi tattici', category: 'tattica', color: '#1B3A5C', bg: '#E8EDF2', icon: 'brain' },
  tecnici: { label: 'Obiettivi tecnici', category: 'tecnica', color: '#C41E3A', bg: '#F8E8EB', icon: 'racquet' },
  insieme: { label: 'Impariamo insieme', category: 'agonismo', color: '#E65100', bg: '#FFF3E0', icon: 'trophy' },
};

/** Ordine di visualizzazione delle aree dentro una tappa (come nel libretto). */
export const KIDS_AREA_ORDER: KidsArea[] = ['mentali', 'motori', 'tattici', 'tecnici', 'insieme'];

// ─── Costruzione delle chiavi ───────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 44)
    .replace(/-+$/g, '');
}

/** FNV-1a a 32 bit, troncato: disambigua slug troncati o quasi uguali. */
function hash4(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).padStart(7, '0').slice(-4);
}

// ─── Formato compatto di scrittura dei dati ─────────────────────────────────
//
// Un obiettivo si scrive come [titolo] oppure [titolo, chiarimento].

type Raw = readonly [string] | readonly [string, string];

interface RawStage {
  steps: [number, number];
  court: string;
  /** Override dell'etichetta dell'ultima area ("Perfezioniamo insieme"). */
  insiemeLabel?: string;
  mentali?: readonly Raw[];
  motori?: readonly Raw[];
  tattici?: readonly Raw[];
  tecnici?: readonly Raw[];
  insieme?: readonly Raw[];
}

function buildStage(slug: string, raw: RawStage): KidsStage {
  const id = `s${raw.steps[0]}_${raw.steps[1]}`;
  const areas: KidsAreaBlock[] = [];

  for (const area of KIDS_AREA_ORDER) {
    const list = raw[area];
    if (!list || list.length === 0) continue;
    const objectives: KidsObjective[] = list.map(([title, hint]) => ({
      key: `${slug}.${id}.${area}.${slugify(title)}-${hash4(title)}`,
      title,
      hint,
      area,
    }));
    areas.push({
      area,
      label: area === 'insieme' ? raw.insiemeLabel ?? KIDS_AREA_CONFIG.insieme.label : KIDS_AREA_CONFIG[area].label,
      objectives,
    });
  }

  return {
    id,
    steps: raw.steps,
    label: `Passi ${raw.steps[0]} e ${raw.steps[1]}`,
    court: raw.court,
    areas,
    objectives: areas.flatMap((a) => a.objectives),
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  DELFINO — "12 passi" (campo Delfino, poi Super Delfino)
// ════════════════════════════════════════════════════════════════════════════

const DELFINO_STAGES: RawStage[] = [
  {
    steps: [1, 2],
    court: 'Delfino',
    mentali: [['Gioco e mi diverto', 'divertimento ed entusiasmo']],
    motori: [['Scopro il campo da tennis, la racchetta e la palla', 'familiarizzazione']],
    tattici: [
      ['Invio la palla al di sopra della rete', 'comprensione delle regole di base del gioco'],
      ['Mando la palla in campo', 'concetto di spazio "in-out"'],
      ['Faccio rimbalzare la palla o la colpisco al volo', 'comprensione di quando colpire a rimbalzo e quando al volo'],
      ["Servo dal basso e dall'alto", 'interpretazione pratica del servizio'],
    ],
    tecnici: [
      ['Colpisco con i piedi fermi a terra', 'equilibrio: posizione di partenza, stance'],
      ['Colpisco muovendo la racchetta in avanti', 'movimento orizzontale della racchetta: impugnatura e preparazioni adatte'],
      ["In ogni colpo uso anche l'altra mano", "azione dell'arto non dominante: rimessa in gioco da parte dell'allievo e lancio di palla nel servizio"],
    ],
    insieme: [["Servizio (eseguito dal basso e dall'alto)"], ['Diritto'], ['Rovescio (a due mani)']],
  },
  {
    steps: [3, 4],
    court: 'Delfino',
    mentali: [
      ['Gioco e mi diverto', 'divertimento ed entusiasmo'],
      ["Imito l'insegnante", 'emulazione'],
      ['Aiuto un compagno', 'collaborazione'],
      ["Mi faccio aiutare dall'insegnante", 'supporto'],
    ],
    motori: [
      ['Gioco a tennis usando braccia e gambe', 'combinazione motoria'],
      ['Afferro, colpisco e lancio la palla da tennis', 'coordinazione occhi-mani'],
      ['Gioco con la mano destra e la sinistra', 'bilateralità'],
    ],
    tattici: [
      ['Invio la palla al di sopra della rete', 'comprensione delle regole di base del gioco'],
      ['Mando la palla in campo', 'concetto di spazio "in-out"'],
      ['Faccio rimbalzare la palla o la colpisco al volo', 'comprensione di quando colpire a rimbalzo e quando al volo'],
      ["Servo dal basso e dall'alto", 'interpretazione pratica del servizio'],
      ['Cerco di non sbagliare', 'regolarità, controllo, precisione'],
      ['Gioco un diritto, un rovescio e vinco il punto con la volée', 'comprensione del concetto di azione di gioco: combinazione di colpi al rimbalzo con colpi al volo'],
      ['Metto in gioco la palla e vinco il punto con la volée', 'interpretazione tattica del servizio'],
    ],
    tecnici: [
      ['Miglioro quello che so già fare', "consolidamento degli obiettivi proposti nelle fasi precedenti: equilibrio, movimento orizzontale della racchetta, azione dell'arto non dominante"],
      ['Sposto il peso da dietro in avanti', 'trasferimento del peso del corpo'],
    ],
  },
  {
    steps: [5, 6],
    court: 'Delfino',
    mentali: [
      ['Gioco e mi diverto', 'divertimento ed entusiasmo'],
      ['Mi confronto con me stesso e con un compagno', 'motivazione'],
    ],
    motori: [
      ['Arrivo sempre prima della palla', 'reazione complessa'],
      ['Colpisco la palla forte o piano', 'differenziazione'],
    ],
    tattici: [
      ['Invio la palla al di sopra della rete', 'comprensione delle regole di base del gioco'],
      ['Mando la palla in campo', 'concetto di spazio "in-out"'],
      ['Faccio rimbalzare la palla o la colpisco al volo', 'comprensione di quando colpire a rimbalzo e quando al volo'],
      ["Servo dal basso e dall'alto", 'interpretazione pratica del servizio'],
      ['Cerco di non sbagliare', 'regolarità, controllo, precisione'],
      ['Gioco un diritto, un rovescio e vinco il punto con la volée', 'combinazione di colpi al rimbalzo con colpi al volo'],
      ['Metto in gioco la palla e vinco il punto con la volée', 'interpretazione tattica del servizio'],
      ['Rispondo al servizio: difesa e attacco', 'comprensione degli aspetti tattici di base associati alla risposta al servizio'],
    ],
    tecnici: [['Miglioro quello che so già fare', 'consolidamento degli obiettivi proposti nelle fasi precedenti']],
  },
  {
    steps: [7, 8],
    court: 'Delfino',
    mentali: [
      ['Gioco e mi diverto', 'divertimento ed entusiasmo'],
      ['Mi confronto con me stesso e con un compagno', 'motivazione'],
      ['Mi pongo un obiettivo', 'definizione degli obiettivi da raggiungere come meta'],
      ['Provo e riprovo per imparare', 'memoria e apprendimento'],
    ],
    motori: [
      ['Raggiungo la palla in tutte le zone del campo', 'coordinazione spazio-temporale'],
      ['Eseguo il rovescio a una e due mani', 'bilateralità'],
    ],
    tattici: [['Miglioro quello che so già fare', 'consolidamento degli obiettivi proposti nelle fasi precedenti']],
    tecnici: [
      ['Miglioro quello che so già fare', "consolidamento: equilibrio, movimento orizzontale della racchetta, azione dell'arto non dominante, trasferimento del peso del corpo, timing esecutivo, tecnica della risposta al servizio"],
      ['Imparo due rovesci differenti', 'variabilità della proposta didattica nelle prese e nelle preparazioni'],
    ],
    insieme: [
      ["Servizio (eseguito dal basso e dall'alto)"],
      ['Diritto'],
      ['Rovescio (a due mani e a una mano)'],
      ['Colpi al volo (volée di diritto e di rovescio; a due mani e a una mano)'],
      ['Risposta al servizio'],
    ],
  },
  {
    steps: [9, 10],
    court: 'Super Delfino',
    mentali: [
      ['Gioco e mi diverto', 'divertimento ed entusiasmo'],
      ['Mi confronto con me stesso e con un compagno', 'motivazione'],
      ['Mi pongo un obiettivo', 'definizione degli obiettivi da raggiungere come meta'],
      ['Provo e riprovo per imparare', 'memoria e apprendimento'],
      ['Tiro la palla dove voglio', 'volitività'],
    ],
    motori: [
      ['Mi muovo in modo corretto in tutte le zone del campo', 'primi approcci al gioco di gambe'],
      ["Utilizzo in modo corretto l'altra mano", 'bilateralità'],
    ],
    tattici: [
      ['Miglioro quello che so già fare', 'consolidamento degli obiettivi proposti nelle fasi precedenti'],
      ["Faccio muovere la palla e l'avversario", 'manovrare'],
    ],
    tecnici: [
      ['Miglioro quello che so già fare', "consolidamento: equilibrio, movimento orizzontale della racchetta, azione dell'arto non dominante, trasferimento del peso del corpo, timing esecutivo, tecnica della risposta al servizio"],
      ['Osservo la palla, parto, arrivo e mi fermo per colpirla', 'studio della palla e tecnica degli spostamenti'],
    ],
    insieme: [
      ["Servizio (eseguito dal basso e dall'alto)"],
      ['Diritto'],
      ['Rovescio (a due mani e a una mano)'],
      ['Colpi al volo (volée di diritto e di rovescio; a due mani e a una mano)'],
      ['Risposta al servizio'],
      ['Spostamenti'],
    ],
  },
  {
    steps: [11, 12],
    court: 'Super Delfino',
    mentali: [
      ['Sono bravo a fare...', 'autoefficacia'],
      ['Invento un nuovo gioco', 'creatività'],
    ],
    motori: [['Riesco a colpire bene anche sopra le spalle', 'ritmo, coordinazione, orientamento']],
    tattici: [
      ['Miglioro quello che so già fare', 'consolidamento degli obiettivi proposti nelle fasi precedenti'],
      ["Osservo la palla, l'avversario e il campo", 'stimolo della visione periferica'],
    ],
    tecnici: [
      ['Miglioro quello che so già fare', "consolidamento: equilibrio, movimento orizzontale della racchetta, azione dell'arto non dominante, trasferimento del peso del corpo, timing esecutivo, tecnica della risposta al servizio"],
      ['Controllo la direzione della palla', 'tecnica delle angolazioni'],
      ['Colpisco la palla al volo anche sopra la testa', 'tecnica dello smash'],
    ],
    insieme: [
      ["Servizio (eseguito dal basso e dall'alto)"],
      ['Diritto'],
      ['Rovescio (a due mani e a una mano)'],
      ['Colpi al volo (volée di diritto e di rovescio; a due mani e a una mano)'],
      ['Risposta al servizio'],
      ['Spostamenti'],
      ['Smash al volo'],
    ],
  },
];

// ════════════════════════════════════════════════════════════════════════════
//  CERBIATTO — "12 passi per diventare più bravo!"
// ════════════════════════════════════════════════════════════════════════════

const CERBIATTO_STAGES: RawStage[] = [
  {
    steps: [1, 2],
    court: 'Cerbiatto, di grandezza ridotta',
    mentali: [["Per migliorare gareggio con l'insegnante o con un compagno", "stimolo l'entusiasmo e la motivazione, in generale e verso il risultato"]],
    motori: [['Riesco a colpire la palla anche in movimento', "esercito l'equilibrio dinamico"]],
    tattici: [
      ['Comprendo il gioco', 'riconosco e intuisco le situazioni di gioco'],
      ['Riesco a controllare anche le palle orange che sono più veloci', 'miglioro il controllo e la precisione del colpo'],
    ],
    tecnici: [
      ['Eseguo vari colpi mantenendo un buon equilibrio anche in movimento', "esercito l'equilibrio dinamico: atteggiamento atletico, tecnica degli spostamenti, posizione"],
      ['Colpisco la palla con un movimento lineare della racchetta', 'impugnatura e preparazioni adatte per il movimento orizzontale della racchetta'],
      ['Colpisco la palla con la giusta scelta di tempo anche con movimenti di preparazione più ampi', 'studio della palla e del tempo di preparazione per eseguire il colpo con tempismo'],
      ['Trasferisco il peso del corpo nel servizio', 'il peso del corpo si sposta dal piede dietro a quello davanti'],
    ],
    insieme: [['Servizio'], ['Diritto'], ['Rovescio']],
  },
  {
    steps: [3, 4],
    court: 'Cerbiatto, di grandezza ridotta',
    mentali: [['Imparo a respirare quando gioco', 'apprendo le corrette tecniche di respirazione']],
    motori: [['Effettuo accelerazioni e decelerazioni verso la rete per colpire la palla forte o piano', 'esercito il gioco di gambe e la varietà di movimento']],
    tattici: [
      ['Capisco il gioco', 'interpretazione tattica delle situazioni di gioco'],
      ['Riesco a controllare anche le palle orange, che sono più veloci', 'aumento il controllo e la precisione'],
      ['Invio la palla a diverse lunghezze', 'mi esercito alla profondità di gioco'],
    ],
    tecnici: [
      ['Miglioro quello che so già fare', 'consolidamento degli obiettivi sviluppati nelle fasi precedenti: movimento orizzontale della racchetta, timing esecutivo'],
      ["Eseguo un saltello prima dell'esecuzione di colpi a rimbalzo e delle volée, nel momento in cui l'avversario colpisce la palla", "esercito l'equilibrio: introduzione della tecnica dello \"split step\", il saltello con allargamento delle gambe e atterraggio sugli avampiedi"],
      ['Trasferisco sempre il peso del corpo in avanti', "controllo l'ampiezza della base di appoggio e la distanza laterale"],
      ["In tutti i colpi utilizzo al meglio anche l'altro braccio", 'equilibrio e simmetria rispetto al braccio che impugna la racchetta'],
    ],
  },
  {
    steps: [5, 6],
    court: 'Cerbiatto, di grandezza ridotta',
    mentali: [['Io e i miei compagni di gioco siamo una vera squadra', 'promuovere fiducia e amicizia nel tuo gruppo tennis']],
    motori: [['Riesco ad afferrare e a lanciare palle ad alta velocità, da fermo e in movimento', 'esercitare la reazione complessa e la combinazione motoria']],
    tattici: [
      ['Miglioro quello che so già fare', 'consolidamento degli obiettivi sviluppati nelle fasi precedenti'],
      ['Imparo a rispondere più velocemente sia di diritto sia di rovescio', 'risposta al servizio: interpretazione tattica della risposta, scelta delle traiettorie'],
      ['Provo a giocare a tennis in coppia', 'introduzione degli aspetti tattici relativi al doppio'],
    ],
    tecnici: [
      ['Miglioro quello che so già fare', 'consolidamento degli obiettivi sviluppati nelle fasi precedenti: equilibrio, movimento orizzontale della racchetta, azione del braccio non dominante, trasferimento del peso del corpo, ritmo esecutivo'],
      ['Miglioro la risposta al servizio', 'posizione di partenza, tecnica del "saltello", posizione, ampiezza della preparazione'],
      ['Intuisco la traiettoria, la direzione e la velocità della palla in arrivo', 'anticipazione motoria'],
    ],
  },
  {
    steps: [7, 8],
    court: 'Cerbiatto, di grandezza ridotta',
    mentali: [['Mi pongo nuovi obiettivi', 'attenzione alla prestazione e al risultato']],
    motori: [["Corro più velocemente in tutte le direzioni del campo, in particolare in avanti e indietro, e imparo a colpire anche sotto l'altezza delle ginocchia", 'gioco di gambe, orientamento, combinazione dei movimenti']],
    tattici: [
      ['Miglioro quello che so già fare', 'consolidamento degli obiettivi sviluppati nelle fasi precedenti'],
      ["Imparo a giocare punti vincenti tirando la palla dove non c'è l'avversario", 'sviluppo della tattica di costruzione del punto e di attacco sfruttando le angolazioni'],
    ],
    tecnici: [
      ['Miglioro quello che so già fare', 'consolidamento degli obiettivi sviluppati nelle fasi precedenti: equilibrio, movimento orizzontale della racchetta, azione del braccio non dominante, trasferimento del peso del corpo, ritmo esecutivo'],
      ['Imparo a giocare colpi vincenti in prossimità della rete e colpi di difesa lontani dalla riga di fondo', 'tecnica degli spostamenti avanti e indietro'],
      ["Imparo a tirare sempre più forte anche dall'alto", 'tecnica dello smash'],
    ],
    insieme: [
      ['Servizio'],
      ['Diritto'],
      ['Rovescio'],
      ['Colpi al volo (volée di diritto e di rovescio)'],
      ['Risposta al servizio'],
      ['Smash al volo'],
    ],
  },
  {
    steps: [9, 10],
    court: 'Super Cerbiatto, più grande e diviso per lungo in due metà',
    mentali: [["Imparo a gestire l'attenzione dentro di me e all'esterno", 'attenzione e concentrazione durante il gioco']],
    motori: [['Imparo a essere al posto giusto nel momento giusto', 'coordinazione tra vista e movimento, accelerazione e orientamento']],
    tattici: [
      ['Miglioro quello che so già fare', 'consolidamento degli obiettivi sviluppati nelle fasi precedenti'],
      ["Imparo a giocare punti vincenti tirando la palla dove non c'è l'avversario, utilizzando anche una corretta tecnica delle rotazioni", 'sviluppo delle fasi tattiche di costruzione del punto e di attacco attraverso le angolazioni e le rotazioni'],
      ['Miglioro sia ad attaccare, sia a difendermi, utilizzando giuste soluzioni di gioco e attraverso un buon utilizzo delle rotazioni', 'sviluppo delle fasi tattiche di costruzione del punto e di attacco'],
    ],
    tecnici: [
      ['Miglioro quello che so già fare', 'consolidamento degli obiettivi sviluppati nelle fasi precedenti: equilibrio, movimento orizzontale della racchetta, azione del braccio non dominante, trasferimento del peso del corpo, ritmo esecutivo'],
      ['Imparo a colpire bene la palla in avanti, con un giusto tempo, variando le angolazioni', "tecnica delle angolazioni: zona d'impatto, traiettoria della racchetta"],
      ['Apprendo la tecnica delle rotazioni', "azione delle gambe e traiettoria dell'assetto braccio-racchetta"],
    ],
  },
  {
    steps: [11, 12],
    court: 'Super Cerbiatto, più grande e diviso per lungo in due metà',
    mentali: [['Scopro le mie emozioni: gioia, orgoglio, delusione, rabbia', 'riconoscimento emozioni']],
    motori: [['Imparo ad accelerare e decelerare colpendo una palla', 'capacità di accelerazione e decelerazione, equilibrio dinamico']],
    tattici: [
      ['Miglioro quello che so già fare', 'consolidamento degli obiettivi sviluppati nelle fasi precedenti'],
      ['In base a traiettorie, angolazioni e velocità della palla adatto i movimenti di preparazione', 'processo di variabilità tecnica'],
    ],
    tecnici: [
      ['Eseguo le diverse tecniche con differenti ampiezze di preparazione', 'consolidamento degli obiettivi sviluppati nelle lezioni precedenti'],
      ['Miglioro la tecnica delle rotazioni', 'tecnica delle rotazioni in top-spin e in back-spin'],
      ["Utilizzo al meglio l'azione dell'altro braccio", "azione dell'arto non dominante"],
    ],
    insieme: [
      ['Servizio'],
      ['Diritto'],
      ['Rovescio'],
      ['Colpi al volo (volée e smash)'],
      ['Risposta al servizio'],
    ],
  },
];

// ════════════════════════════════════════════════════════════════════════════
//  COCCODRILLO — "12 passi per diventare un campione!"
// ════════════════════════════════════════════════════════════════════════════

const COCCODRILLO_STAGES: RawStage[] = [
  {
    steps: [1, 2],
    court: 'Coccodrillo',
    mentali: [
      ['Mi impegno per dare il massimo in allenamento', 'motivazione allo sport agonistico'],
      ['Mi piace lottare per vincere in partita', 'motivazione allo sport agonistico'],
    ],
    motori: [
      ['Imparo a controllare sempre meglio il mio corpo sul campo', 'incremento delle capacità coordinative'],
      ['Imparo a muovermi con passi più lunghi in un campo sempre più grande', 'sviluppo delle capacità organico-muscolari'],
    ],
    tattici: [
      ['Cerco di fare meno errori possibile', 'regolarità: controllo, precisione, margine di errore'],
      ["Obbligo l'avversario a muoversi di più sul campo più grande", "angolazioni: scelta della direzione, scelta della traiettoria dell'attrezzo"],
      ["Provo a prendere l'iniziativa con il servizio e con la risposta al servizio", 'interpretazione tattica dei colpi di inizio gioco: atteggiamento tattico pro-attivo'],
    ],
    tecnici: [
      ['Faccio attenzione alla tecnica degli spostamenti'],
      ['Faccio attenzione a come colpisco la palla', 'movimento orizzontale e angolare della racchetta: impugnature adatte, preparazioni adatte, tecnica delle angolazioni'],
      ['Effettuo un buon servizio anche sul campo più grande e con la rete più alta', 'tecniche dei piedi "foot-back" e "foot-up", azione dell\'arto non dominante, timing esecutivo'],
    ],
  },
  {
    steps: [3, 4],
    court: 'Coccodrillo',
    mentali: [
      ['Respiro per rilassarmi tra i punti', 'respirazione: attivante/disattivante'],
      ['Respiro per attivarmi tra i punti', 'respirazione: attivante/disattivante'],
    ],
    motori: [
      ['Imparo a utilizzare il braccio e la mano ad alte velocità', 'incremento delle capacità coordinative'],
      ['Imparo a contrarre e decontrarre il braccio della racchetta', 'sviluppo delle capacità organico-muscolari'],
    ],
    tattici: [
      ['Miglioro quello che so già fare', "consolidamento degli obiettivi: controllo, precisione, margine di errore, scelta della direzione, scelta della traiettoria dell'attrezzo"],
      ['Scelgo la tipologia di rotazione in base alla situazione tattica', 'scelta tattica della tipologia di rotazione e del grado di rotazione'],
      ["Provo a prendere l'iniziativa con il servizio e con la risposta al servizio", 'interpretazione tattica dei colpi di inizio gioco: atteggiamento tattico pro-attivo'],
    ],
    tecnici: [
      ['Miglioro la tecnica dei colpi al volo', 'tecnica delle volée: tecnica dello "split step", ampiezza delle preparazioni. Tecnica dello smash: ricerca di palla, azione dell\'arto non dominante'],
      ["Gioco a tennis sempre meglio grazie all'utilizzo delle rotazioni", 'movimento orizzontale e angolare della racchetta: impugnature e preparazioni adatte'],
    ],
  },
  {
    steps: [5, 6],
    court: 'Coccodrillo',
    mentali: [['So stringere forte o piano la presa sulla racchetta', 'rapporto tra tensione muscolare e prestazione']],
    motori: [
      ['Corro più velocemente verso la rete', 'incremento delle capacità coordinative'],
      ['Uso tutta la mia energia per correre in avanti', 'sviluppo delle capacità organico-muscolari'],
    ],
    tattici: [
      ['Miglioro ulteriormente quello che so già fare', 'consolidamento degli obiettivi sviluppati nelle fasi precedenti'],
      ["Imparo ad attaccare quando l'avversario accorcia la palla", 'interpretazione tattica delle fasi di attacco e di chiusura del punto'],
      ['Utilizzo tatticamente la palla corta', 'scelta delle rotazioni'],
      ['Imparo ad anticipare il mio avversario', 'applicazione tattica dell\'anticipo di palla'],
    ],
    tecnici: [
      ['Miglioro ulteriormente quello che so già fare', "consolidamento degli obiettivi sviluppati nelle fasi precedenti: azione delle gambe, timing esecutivo, combinazione della traiettoria orizzontale e angolare dell'attrezzo"],
      ['Imparo a colpire in avanzamento utilizzando i passi giusti', 'tecnica dell\'approccio a rete, tecnica degli spostamenti in avanti'],
    ],
  },
  {
    steps: [7, 8],
    court: 'Coccodrillo',
    mentali: [
      ['Mi vedo servire ace', 'visualizzazione'],
      ['Mi vedo rispondere vincente', 'visualizzazione'],
    ],
    motori: [
      ['Imparo a utilizzare diverse velocità esecutive con mani e piedi', 'incremento delle capacità coordinative'],
      ['Imparo a controllare la mia forza', 'sviluppo delle capacità organico-muscolari'],
    ],
    tattici: [
      ['Miglioro quello che so già fare', 'consolidamento degli obiettivi sviluppati nelle fasi precedenti'],
      ['Imparo a giocare palle lente e veloci in base alla posizione del campo in cui mi trovo', 'variazioni di ritmo'],
    ],
    tecnici: [
      ['Miglioro quello che so già fare', "consolidamento degli obiettivi sviluppati nelle fasi precedenti: azione delle gambe, timing esecutivo, combinazione della traiettoria orizzontale e angolare dell'attrezzo"],
      ["Utilizzo tutte le parti del corpo nell'esecuzione dei vari colpi", 'coordinazione di tutte le parti del corpo: utilizzo corretto della catena cinetica e simmetria di azione tra parte destra e sinistra del corpo'],
      ['Utilizzo il trasferimento del peso del corpo e la torsione del tronco per tirare più forte', 'combinazione di traslazione e rotazione: combinazione di trasferimento del peso del corpo e rotazione del tronco'],
      ['Mi sposto meglio in avanti e indietro', 'tecnica degli spostamenti in avanti e indietro'],
    ],
  },
  {
    steps: [9, 10],
    court: 'Regolamentare',
    mentali: [
      ['Miglioro la mia concentrazione', 'flessibilità e attenzione'],
      ['Decido la velocità di palla', 'flessibilità e attenzione'],
    ],
    motori: [
      ['Imparo ad arrivare in diversi punti del campo assumendo diverse stance', 'incremento delle capacità coordinative'],
      ["Effettuo sempre l'ultimo passo molto ampio", 'sviluppo delle capacità organico-muscolari'],
    ],
    tattici: [
      ['Miglioro quello che so già fare', 'consolidamento degli obiettivi sviluppati nelle fasi precedenti'],
      ['Cerco di uscire quanto prima dalla fase di difesa con palle alte e profonde', 'interpretazione tattica della fase di difesa'],
      ['Uso il servizio corretto al momento giusto', 'scelta delle rotazioni nel servizio'],
    ],
    tecnici: [
      ['Miglioro quello che so già fare', "consolidamento degli obiettivi sviluppati nelle fasi precedenti: azione delle gambe, timing esecutivo, combinazione della traiettoria orizzontale e angolare dell'attrezzo, coordinazione dei segmenti corporei, combinazione di traslazione e rotazione"],
      ['Uso le giuste stance per colpire la palla in base alla velocità della palla in arrivo e alla posizione del campo in cui mi trovo', 'tecnica delle stance: trasferimento del peso del corpo e rotazione del tronco'],
      ["Uso al meglio l'azione delle gambe nel servizio", 'tecnica di atterraggio, uscita dal servizio'],
    ],
  },
  {
    steps: [11, 12],
    court: 'Regolamentare',
    insiemeLabel: 'Perfezioniamo insieme',
    mentali: [['Penso positivo anche quando sbaglio', 'costruire la fiducia']],
    motori: [
      ['Cerco di reagire prima e di essere sempre più veloce', 'incremento delle capacità coordinative'],
      ['Uso più forza, resistenza e velocità', 'sviluppo delle capacità organico-muscolari'],
    ],
    tattici: [
      ['Imparo a capire nel più breve tempo possibile dove e come il mio avversario invierà la palla', "anticipazione dell'azione tattica"],
      ["Controllo l'azione periferica", 'consolidamento degli obiettivi sviluppati nelle fasi precedenti'],
    ],
    tecnici: [
      ['Gioco a tutto campo variando sistematicamente colpi e rotazioni', 'consolidamento degli obiettivi sviluppati nelle lezioni precedenti'],
      ["Miglioro l'abilità di colpire la palla in fase ascendente", "tecnica dell'anticipo"],
    ],
    insieme: [
      ['Servizio'],
      ['Risposta al servizio'],
      ['Diritto'],
      ['Rovescio'],
      ['Colpi al volo (schiaffo al volo)'],
    ],
  },
];

// ════════════════════════════════════════════════════════════════════════════
//  I TRE PERCORSI
// ════════════════════════════════════════════════════════════════════════════

export const KIDS_PROGRAMS: Record<PlayerLevel, KidsProgram> = {
  DELFINO: {
    level: 'DELFINO',
    slug: 'delfino',
    name: 'Delfino',
    headline: '12 passi',
    intro:
      'Il percorso del tuo viaggio introduttivo nel mondo del tennis è composto da 12 passi. Ogni passo ti regalerà una novità: una nuova azione da imparare, un\'abilità tecnica da apprendere oppure una difficoltà da superare.',
    emoji: '🐬',
    colors: { accent: '#C41E3A', accentDark: '#8E1428', soft: '#FDECEF', ink: '#1B3A5C' },
    stages: DELFINO_STAGES.map((s) => buildStage('delfino', s)),
  },
  CERBIATTO: {
    level: 'CERBIATTO',
    slug: 'cerbiatto',
    name: 'Cerbiatto',
    headline: '12 passi per diventare più bravo!',
    intro:
      'Il tuo viaggio da Cerbiatto nel mondo del tennis è composto da 12 passi, raggruppati a due a due (come i tuoi piedi!): ognuno ti offrirà una novità che ti servirà ad alzare sempre di più il tuo livello di gioco.',
    emoji: '🦌',
    colors: { accent: '#E8871A', accentDark: '#A85A00', soft: '#FFF3E3', ink: '#1B3A5C' },
    stages: CERBIATTO_STAGES.map((s) => buildStage('cerbiatto', s)),
  },
  COCCODRILLO: {
    level: 'COCCODRILLO',
    slug: 'coccodrillo',
    name: 'Coccodrillo',
    headline: '12 passi per diventare un campione!',
    intro:
      'Anche il percorso della terza parte del tuo viaggio nel mondo del tennis è composto da 12 passi. Ogni passo ti offrirà una novità: una nuova azione tattica, qualche tecnica da perfezionare o una difficoltà maggiore da superare.',
    emoji: '🐊',
    colors: { accent: '#2E9E4F', accentDark: '#166534', soft: '#E9F7EE', ink: '#1B3A5C' },
    stages: COCCODRILLO_STAGES.map((s) => buildStage('coccodrillo', s)),
  },
};

/** Ordine di progressione: finito un percorso si passa al successivo. */
export const KIDS_LEVEL_ORDER: PlayerLevel[] = ['DELFINO', 'CERBIATTO', 'COCCODRILLO'];

export const KIDS_PROGRAM_LIST: KidsProgram[] = KIDS_LEVEL_ORDER.map((l) => KIDS_PROGRAMS[l]);

/** Livello successivo, oppure null se e' l'ultimo. */
export function kidsNextLevel(level: PlayerLevel): PlayerLevel | null {
  const i = KIDS_LEVEL_ORDER.indexOf(level);
  if (i < 0 || i >= KIDS_LEVEL_ORDER.length - 1) return null;
  return KIDS_LEVEL_ORDER[i + 1];
}

/**
 * Normalizza il campo `level` del profilo (che a volte contiene un
 * ranking FIT) su uno dei tre percorsi. Default: DELFINO.
 */
export function kidsLevelOf(rawLevel: string | null | undefined): PlayerLevel {
  const v = (rawLevel ?? '').trim().toUpperCase();
  return (KIDS_LEVEL_ORDER as string[]).includes(v) ? (v as PlayerLevel) : 'DELFINO';
}

/** Numero totale di obiettivi di un percorso. */
export function kidsTotalObjectives(program: KidsProgram): number {
  return program.stages.reduce((n, s) => n + s.objectives.length, 0);
}

/** Tutte le chiavi di un percorso (usata dai test e dal seed dei totali). */
export function kidsAllKeys(program: KidsProgram): string[] {
  return program.stages.flatMap((s) => s.objectives.map((o) => o.key));
}

// ─── Da 6 pagine a 12 passi ─────────────────────────────────────────────────
//
// Il libretto elenca gli obiettivi per COPPIA di passi (una pagina = passi
// 1 e 2). Il percorso in app, pero', mostra 12 tappe distinte: serve quindi
// ripartire gli obiettivi della pagina fra i suoi due passi.
//
// La divisione NON spezza mai un'area a meta': si assegnano BLOCCHI INTERI
// (mentali, motori, tattici, tecnici, insieme) al primo passo finche' ci si
// avvicina alla meta' degli obiettivi, il resto va al secondo. Cosi' ogni
// passo resta didatticamente sensato ("Passo 1: mentali, motori e tattici";
// "Passo 2: tecnici e Impariamo insieme") invece di tagliare una lista in due.

export interface KidsStepSplit {
  /** Aree assegnate a questo passo (blocchi interi, in ordine di libretto). */
  areas: KidsAreaBlock[];
  objectives: KidsObjective[];
}

/**
 * Ripartisce le aree di una tappa fra il primo e il secondo passo.
 * Deterministico: stesso input, stessa divisione.
 */
export function splitStageIntoSteps(stage: KidsStage): [KidsStepSplit, KidsStepSplit] {
  const total = stage.objectives.length;
  const target = total / 2;

  let cut = 0; // quante aree finiscono nel primo passo
  let running = 0;
  for (let i = 0; i < stage.areas.length; i++) {
    const next = running + stage.areas[i].objectives.length;
    // Ci si ferma quando aggiungere l'area seguente allontanerebbe dalla
    // meta' piu' di quanto non lo sia gia' il conteggio corrente.
    if (i > 0 && Math.abs(next - target) > Math.abs(running - target)) break;
    running = next;
    cut = i + 1;
  }

  // Entrambi i passi devono avere almeno un'area.
  if (cut >= stage.areas.length && stage.areas.length > 1) cut = stage.areas.length - 1;
  if (cut < 1) cut = 1;

  const first = stage.areas.slice(0, cut);
  const second = stage.areas.slice(cut);

  return [
    { areas: first, objectives: first.flatMap((a) => a.objectives) },
    { areas: second, objectives: second.flatMap((a) => a.objectives) },
  ];
}

/** Etichetta sintetica delle aree di un passo, es. "mentali, motori e tattici". */
export function areasSummary(areas: KidsAreaBlock[]): string {
  const names = areas.map((a) => (a.area === 'insieme' ? a.label.toLowerCase() : a.area));
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}
