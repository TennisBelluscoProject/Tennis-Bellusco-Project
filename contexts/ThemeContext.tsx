'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { THEME_STORAGE_KEY } from '@/lib/theme-script';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  /** true finche' non sappiamo cosa ha deciso il browser (primo render server). */
  pending: boolean;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Il valore vero e' gia' sull'<html> (lo mette themeInitScript). Qui si
  // parte da 'light' solo perche' il server deve pur rendere qualcosa, e si
  // legge la verita' al primo effetto: `pending` serve a non far lampeggiare
  // l'icona sbagliata nel frattempo.
  const [theme, setThemeState] = useState<Theme>('light');
  const [pending, setPending] = useState(true);

  useEffect(() => {
    setThemeState(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    setPending(false);
  }, []);

  // Se l'utente non ha mai scelto, l'app segue il sistema anche a runtime:
  // cambiare tema al sistema operativo si riflette qui senza ricaricare.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      applyTheme(e.matches ? 'dark' : 'light');
      setThemeState(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* modalita' privata o storage pieno: il tema vale per questa sessione */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
  }, [setTheme]);

  const value = useMemo(
    () => ({ theme, pending, setTheme, toggle }),
    [theme, pending, setTheme, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme va usato dentro <ThemeProvider>');
  return ctx;
}

/**
 * Applica il tema disattivando per un istante le transizioni CSS.
 *
 * Senza questa pausa ogni bordo, ombra e testo della pagina animerebbe il
 * proprio colore per conto suo: centinaia di transizioni sfasate, che di
 * fatto e' lo sfarfallio che si vede in molte app al cambio tema. Cosi'
 * invece cambia tutto insieme, e le transizioni tornano subito attive per
 * gli usi normali.
 */
function applyTheme(next: Theme) {
  const root = document.documentElement;
  const stop = document.createElement('style');
  stop.appendChild(
    document.createTextNode('*,*::before,*::after{transition:none!important}')
  );
  document.head.appendChild(stop);

  root.classList.toggle('dark', next === 'dark');
  root.style.colorScheme = next;

  // Forza un reflow: garantisce che il browser applichi i nuovi colori
  // mentre le transizioni sono ancora spente.
  void window.getComputedStyle(stop).opacity;
  document.head.removeChild(stop);
}
