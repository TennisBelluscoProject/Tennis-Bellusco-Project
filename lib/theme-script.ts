/**
 * Script che decide il tema PRIMA della prima pittura.
 *
 * Va iniettato in <head> come script sincrono: se il tema venisse applicato
 * da React, fra il primo paint e l'idratazione si vedrebbe un lampo bianco
 * (o nero) a ogni caricamento. Qui la classe e' gia' sull'<html> quando il
 * browser disegna la prima volta.
 *
 * Regola: vince la scelta salvata; se non c'e', si segue il sistema.
 */
export const THEME_STORAGE_KEY = 'tcb-theme';

/**
 * Le due tinte della barra di sistema, in coppia con `--background` dei due
 * temi in app/globals.css. Vivono qui e non in `viewport.themeColor` perche'
 * la scelta la fa la classe `.dark`, non `prefers-color-scheme`: un meta
 * statico con i media query risponderebbe al telefono invece che all'app.
 *
 * Se `--background` cambia, questi due valori vanno cambiati con lui.
 */
export const THEME_COLORS = { light: '#EBECF2', dark: '#101013' } as const;

/**
 * Allinea `<meta name="theme-color">` al tema applicato.
 *
 * La barra di stato del telefono e la cornice del browser leggono quel meta:
 * senza questo, cambiare tema dentro l'app lasciava una striscia del colore
 * sbagliato sopra e sotto il contenuto.
 */
export function syncThemeColorMeta(theme: 'light' | 'dark') {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', THEME_COLORS[theme]);
}

export const themeInitScript = `
(function () {
  try {
    var saved = localStorage.getItem('${THEME_STORAGE_KEY}');
    var dark = saved
      ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    var root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';

    var meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', dark ? '${THEME_COLORS.dark}' : '${THEME_COLORS.light}');
    document.head.appendChild(meta);
  } catch (e) {}
})();
`;
