/**
 * Altezza REALE della parte visibile, in `--app-h`, decisa PRIMA della prima
 * pittura e tenuta aggiornata da li' in poi.
 *
 * Perche' non basta un'unita' CSS.
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
 * davvero vedendo in questo istante, barre aperte o chiuse, in scheda o come
 * app installata. Lo si legge e lo si riscrive quando cambia.
 *
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

    // Installata sulla schermata Home non c'e' nessuna barra retrattile: le
    // varie misure possono discordare (su iOS in standalone
    // \`visualViewport.height\` sa restare sotto lo schermo vero), ma nessuna
    // puo' essere TROPPO alta, perche' non c'e' niente dietro cui nascondersi.
    // Li' la piu' grande e' quella giusta. In scheda invece vale il contrario:
    // la piu' grande includerebbe l'area dietro la barra del browser, quindi
    // ci si fida solo di \`visualViewport\`.
    function standalone() {
      try {
        return (
          window.matchMedia('(display-mode: standalone)').matches ||
          window.matchMedia('(display-mode: fullscreen)').matches ||
          window.navigator.standalone === true
        );
      } catch (e) {
        return false;
      }
    }

    function scrive() {
      var a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
      var h;
      if (standalone()) {
        h = Math.max(
          vv ? vv.height : 0,
          window.innerHeight || 0,
          document.documentElement.clientHeight || 0
        );
      } else {
        h = vv ? vv.height : window.innerHeight;
      }
      if (!h) return;
      root.style.setProperty('--app-h', Math.round(h) + 'px');
    }

    scrive();
    if (vv) vv.addEventListener('resize', scrive);
    window.addEventListener('resize', scrive);
    // La rotazione riporta le misure buone solo a giro finito.
    window.addEventListener('orientationchange', function () { setTimeout(scrive, 120); });
  } catch (e) {}
})();
`;
