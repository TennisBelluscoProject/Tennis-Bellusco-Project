'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * L'evento con cui Chrome offre di installare la web app.
 *
 * Non sta nei tipi standard di lib.dom (e' una proposta, non uno standard),
 * quindi lo dichiariamo qui al minimo indispensabile — stessa scelta fatta
 * per `startViewTransition` in components/ui/AnimatedThemeToggler.tsx.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/* ─────────────────────────────────────────────────────────────────────────
   UN SOLO GETTONE PER TUTTA L'APP.

   L'evento e' uno, arriva una volta e si spende una volta: tenerlo nello
   stato di un componente vorrebbe dire che due pulsanti montati insieme ne
   avrebbero una copia per uno, e spenderne uno lascerebbe l'altro acceso a
   promettere un'installazione che non puo' piu' fare. Oggi i due punti in cui
   compare non convivono mai sullo stesso schermo (home del maestro, profilo
   dell'allievo), ma e' una coincidenza dell'impaginazione di adesso, non una
   garanzia.

   Sta quindi qui fuori, con un solo ascolto sulla finestra per tutta la
   pagina, e i componenti ci si affacciano con `useSyncExternalStore` — lo
   stesso meccanismo che lib/hooks.ts usa per la larghezza dello schermo.
   ───────────────────────────────────────────────────────────────────────── */

let gettone: BeforeInstallPromptEvent | null = null;
const iscritti = new Set<() => void>();
let inAscolto = false;

function avvisaTutti() {
  for (const notifica of iscritti) notifica();
}

function iniziaAdAscoltare() {
  if (inAscolto || typeof window === 'undefined') return;
  inAscolto = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Senza questo Chrome mostra la SUA barretta e si tiene l'evento.
    e.preventDefault();
    gettone = e as BeforeInstallPromptEvent;
    avvisaTutti();
  });

  // A installazione avvenuta il pulsante non ha piu' senso: sparisce senza
  // aspettare un ricaricamento.
  window.addEventListener('appinstalled', () => {
    gettone = null;
    avvisaTutti();
  });
}

function iscriviti(notifica: () => void) {
  iniziaAdAscoltare();
  iscritti.add(notifica);
  return () => {
    iscritti.delete(notifica);
  };
}

/**
 * Dice se l'app si puo' installare adesso, e come farlo.
 *
 * COME FUNZIONA. Quando una pagina soddisfa i requisiti di installabilita'
 * (HTTPS, manifest con nome e icone, service worker con un handler `fetch`)
 * Chrome emette `beforeinstallprompt` invece di mostrare la sua barretta. Se
 * lo si intercetta e si blocca il comportamento di default, quell'evento
 * diventa un gettone: si mette da parte e lo si spende quando si vuole,
 * facendo comparire la finestra di sistema da un pulsante nostro.
 *
 * IL GETTONE VALE UNA VOLTA SOLA. Dopo `prompt()` l'evento e' consumato e va
 * buttato: richiamarlo darebbe errore. Se la persona annulla, Chrome ne
 * emettera' un altro piu' avanti — e il pulsante tornera' da solo.
 *
 * SOLO ANDROID, di fatto. Safari non ha mai esposto questa API: su iPhone
 * l'evento non arriva, `canInstall` resta falso e il pulsante non compare.
 * E' voluto — meglio niente che un pulsante che non fa nulla.
 *
 * NOTA sul momento in cui si aggancia l'ascolto: l'evento arriva dopo che il
 * service worker e' stato registrato, e la registrazione avviene sull'evento
 * `load` della finestra (vedi il ServiceWorkerRegister in app/layout.tsx),
 * cioe' dopo l'idratazione di React. L'ascolto e' quindi in tempo. Se un
 * giorno si scoprisse che su qualche dispositivo l'evento precede il
 * montaggio, la cura e' metterlo da parte gia' nello script in <head>, come
 * si fa per il tema.
 */
export function useInstallPrompt() {
  const evento = useSyncExternalStore(
    iscriviti,
    () => gettone,
    () => null // sul server non c'e' nessuna finestra da installare
  );

  const install = useCallback(async () => {
    const e = gettone;
    if (!e) return;
    // Si butta SUBITO, non dopo la risposta: il gettone e' gia' speso nel
    // momento in cui si chiama `prompt()`, e tenerlo permetterebbe un secondo
    // clic che fallirebbe.
    gettone = null;
    avvisaTutti();
    try {
      await e.prompt();
      await e.userChoice;
    } catch {
      /* finestra gia' consumata o chiusa dal sistema: non c'e' nulla da fare */
    }
  }, []);

  return { canInstall: evento !== null, install };
}
