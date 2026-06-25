/**
 * Dati di esempio per l'anteprima "Il mio percorso" (Iterazione A).
 *
 * In Iterazione B questi dati verranno sostituiti dai veri nodi/archi del
 * percorso attivato e dallo stato dei goal materializzati dell'allievo.
 *
 * Il grafo qui sotto e' un DAG con una biforcazione, scelto per mostrare:
 *   - il LAYERING (cammino piu' lungo) che dispone i nodi su piu' righe;
 *   - la FRONTIERA SBLOCCATA (un nodo completato sblocca i successivi);
 *   - i tre stati visivi: completato, in corso, disponibile, bloccato.
 */

import type { PathTreeData } from '@/components/PathTreeView';

export const SAMPLE_PATH: PathTreeData = {
  title: 'Fondamentali da fondo campo',
  difficulty: 'CERBIATTO',
  nodes: [
    { id: 'a', title: 'Impugnatura eastern', category: 'tecnica', status: 'completed',
      description: 'Stabilizzare la presa eastern di dritto come base del colpo.' },
    { id: 'b', title: 'Dritto incrociato costante', category: 'tecnica', status: 'in_progress', progress: 60,
      description: '10 palle consecutive incrociate dentro il campo.' },
    { id: 'c', title: 'Rovescio a due mani', category: 'tecnica', status: 'planned',
      description: 'Costruire il rovescio bimane partendo dalla spalla.' },
    { id: 'd', title: 'Spostamento laterale', category: 'fisico', status: 'planned',
      description: 'Passi di aggiustamento e recupero del centro.' },
    { id: 'e', title: 'Scambio da fondo 10 colpi', category: 'tattica', status: 'planned',
      description: 'Mantenere lo scambio gestendo profondita\u0027 e margine.' },
    { id: 'f', title: 'Costruzione del punto', category: 'tattica', status: 'planned',
      description: 'Spostare l\u0027avversario e chiudere a rete.' },
  ],
  // from = prerequisito, to = dipendente
  edges: [
    { from: 'a', to: 'b' },
    { from: 'a', to: 'c' },
    { from: 'b', to: 'e' },
    { from: 'c', to: 'e' },
    { from: 'd', to: 'e' },
    { from: 'e', to: 'f' },
  ],
};
