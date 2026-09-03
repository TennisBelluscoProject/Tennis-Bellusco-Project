'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Vero sotto il punto di rottura indicato.
 *
 * Legge la media query in modo SINCRONO, gia' al primo render del client.
 *
 * Perche' non un `useState(false)` + `useEffect`, che e' come era scritto
 * prima: l'effetto gira DOPO la prima pittura, quindi su telefono la pagina
 * veniva disegnata una volta con il layout da desktop e subito dopo sostituita
 * con quello mobile. Su questa app significava montare il Kanban a tre
 * colonne, buttarlo via e montare il nastro — un lampo a ogni caricamento, e
 * un rimontaggio completo che azzerava ogni animazione in corso.
 *
 * `useSyncExternalStore` risolve proprio questo caso: il valore giusto e' gia'
 * disponibile durante l'idratazione. `getServerSnapshot` ritorna false perche'
 * sul server la larghezza non esiste; React riconcilia al primo render del
 * client, prima di dipingere.
 */
export function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint - 1}px)`;

  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
