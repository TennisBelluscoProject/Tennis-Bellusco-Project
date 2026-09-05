/**
 * Altezza REALE della parte visibile, in `--app-h`.
 *
 * DUE CASI DIVERSI, E SOLO UNO VA MISURATO.
 *
 * ── In scheda del browser ─────────────────────────────────────────────────
 * Qui il viewport e' variabile: la barra degli indirizzi si ritrae e torna, e
 * nessuna unita' CSS descrive bene quel movimento.
 *
 *   - `dvh` insegue il viewport, ma finche' la pagina non si assesta iOS lo
 *     risolve con il viewport GRANDE. Il guscio nasceva percio' piu' alto
 *     dello schermo e, quando l'altezza finiva anche sul body, rendeva il
 *     documento scorrevole: bastava quello scorrimento per far ritirare la
 *     barra del browser, il vuoto in fondo si chiudeva e non tornava piu'.
 *   - `svh` e' il viewport con le barre APERTE. Non e' mai piu' alto del
 *     visibile — quindi niente scorrimento fantasma — ma se le barre sono
 *     RITIRATE resta corto, e sotto avanza una striscia fissa che non si
 *     chiude piu'. E' conservativo, non variabile.
 *
 * `visualViewport.height` non e' una stima: e' il rettangolo che l'utente sta
 * davvero vedendo in questo istante, barre aperte o chiuse. Lo si legge e lo
 * si riscrive quando cambia.
 *
 * ── Installata sulla schermata Home (standalone) ──────────────────────────
 * QUI NON SI MISURA NIENTE, e non e' un dettaglio: era il difetto.
 *
 * In standalone non esiste nessuna barra retrattile, quindi il viewport NON
 * e' variabile — e' lo schermo, sempre. Non c'e' proprio il problema che
 * questo script e' nato per risolvere. In compenso c'e' quello opposto: al
 * lancio, prima che iOS applichi `viewport-fit=cover` e la barra di stato
 * traslucida, `visualViewport.height`, `window.innerHeight` e `clientHeight`
 * riportano TUTTI E TRE un'altezza ancora priva della fascia di stato — una
 * quarantina di punti in meno dello schermo vero. Prendere la piu' grande dei
 * tre non bastava: erano sbagliate insieme.
 *
 * Il guscio nasceva quindi piu' CORTO dello schermo, e sotto alla barra di
 * navigazione restava una striscia di sfondo. Poi spariva, perche' la misura
 * veniva riscritta al primo evento di `resize` — ma iOS quell'evento non lo
 * manda quando la barra di stato passa a traslucida, quindi la striscia
 * restava li' finche' non capitava altro (una rotazione, la tastiera, un
 * cambio di scheda).
 *
 * La cura e' togliere la misura, non renderla piu' furba: in standalone si
 * marca <html> con `data-standalone` e l'altezza la decide il CSS con `vh`
 * (vedi globals.css). Una unita' CSS non e' una fotografia: il motore la
 * ri-risolve da sola quando il rettangolo cambia, senza bisogno di nessun
 * evento. E' esattamente la garanzia che a una misura presa in JavaScript
 * manca.
 *
 * `vh` e non `dvh`: in standalone valgono lo stesso (non c'e' niente che si
 * ritrae) e `vh` lo capiscono anche i telefoni vecchi.
 *
 * ── Perche' in <head> ─────────────────────────────────────────────────────
 * Sta in <head> come script sincrono, non in un effetto React: un effetto
 * gira DOPO la prima pittura, e il primo fotogramma verrebbe disegnato con
 * l'altezza sbagliata — cioe' esattamente il lampo che si vuole togliere.
 *
 * LA TASTIERA NON CONTA. Aprendola `visualViewport.height` crolla, e seguirla
 * vorrebbe dire far collassare il guscio (e saltare la barra di navigazione a
 * meta' schermo) a ogni tocco su un campo di ricerca. Mentre si scrive
 * l'altezza resta quella di prima e la tastiera si limita a coprire.
 */
export const viewportInitScript = `
(function () {
  try {
    var root = document.documentElement;
    var vv = window.visualViewport;

    // Su iOS il media query \`display-mode\` ha tardato anni ad arrivare, e su
    // qualche versione ancora non risponde: \`navigator.standalone\` resta il
    // segnale piu' affidabile li'. Si guardano tutti e due.
    function standalone() {
      try {
        return (
          window.navigator.standalone === true ||
          window.matchMedia('(display-mode: standalone)').matches ||
          window.matchMedia('(display-mode: fullscreen)').matches ||
          window.matchMedia('(display-mode: minimal-ui)').matches
        );
      } catch (e) {
        return false;
      }
    }

    function scrive() {
      if (standalone()) {
        // Niente misura: comanda il CSS. Va tolta anche quella eventualmente
        // gia' scritta, perche' uno stile in linea batte qualunque foglio.
        if (!root.hasAttribute('data-standalone')) root.setAttribute('data-standalone', '');
        if (root.style.getPropertyValue('--app-h')) root.style.removeProperty('--app-h');
        return;
      }
      if (root.hasAttribute('data-standalone')) root.removeAttribute('data-standalone');

      var a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
      var h = vv ? vv.height : window.innerHeight;
      if (!h) return;
      root.style.setProperty('--app-h', Math.round(h) + 'px');
    }

    scrive();
    if (vv) vv.addEventListener('resize', scrive);
    window.addEventListener('resize', scrive);
    // Tornando da bfcache la pagina non si ricarica: lo stato va riletto.
    window.addEventListener('pageshow', scrive);
    // La rotazione riporta le misure buone solo a giro finito.
    window.addEventListener('orientationchange', function () { setTimeout(scrive, 120); });

    // Se \`display-mode\` si decide dopo il primo giro (succede: la finestra
    // parte in scheda e viene adottata dall'app installata), si ricalcola.
    try {
      var mq = window.matchMedia('(display-mode: standalone)');
      if (mq.addEventListener) mq.addEventListener('change', scrive);
      else if (mq.addListener) mq.addListener(scrive);
    } catch (e) {}
  } catch (e) {}
})();
`;
