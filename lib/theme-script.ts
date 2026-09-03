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
  } catch (e) {}
})();
`;
