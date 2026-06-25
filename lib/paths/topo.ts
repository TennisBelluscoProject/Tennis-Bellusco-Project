/**
 * ╭──────────────────────────────────────────────────────────────────────╮
 * │  PERCORSI DI OBIETTIVI — ALGORITMO ESIBITO (Ordinamento topologico)   │
 * ╰──────────────────────────────────────────────────────────────────────╯
 *
 * `computePathState` esegue UN SOLO attraversamento del grafo, in ordinamento
 * topologico secondo l'algoritmo di Kahn (1962), e ricava tre informazioni:
 *
 *   1. VALIDAZIONE — calcola l'in-degree di ogni nodo, consuma le radici
 *      (in-degree 0) propagando la rimozione degli archi. Se al termine il
 *      numero di nodi processati e' < |V|, esiste un CICLO: il grafo NON e' un
 *      DAG valido (`valid = false`). Usato anche dall'editor del maestro per
 *      rifiutare percorsi ciclici al salvataggio (Iterazione B).
 *
 *   2. LAYERING — `layer[v] = max(layer[prerequisiti]) + 1` (radici = 0).
 *      E' la lunghezza del cammino piu' lungo che termina in `v` nel DAG e
 *      fornisce la coordinata Y / riga di ogni nodo per il disegno dell'albero.
 *
 *   3. FRONTIERA SBLOCCATA — un nodo e' sbloccato se e solo se TUTTI i suoi
 *      prerequisiti sono `completed`. Le radici sono sbloccate da subito.
 *      `blockedBy[v]` elenca i prerequisiti mancanti (per il messaggio
 *      "Completa X e Y per sbloccare").
 *
 * Complessita': O(V + E) in tempo e in spazio.
 *
 * FUNZIONE PURA: nessun tipo Supabase, nessun React, nessun side-effect.
 * Riceve nodi/archi/insieme-dei-completati e ritorna un risultato immutabile.
 * E' questo a renderla riusabile su qualunque frontend e indipendente dal
 * data layer (vedi ARCHITECTURE.txt, principio "Information hiding").
 */

// ─── Tipi del dominio dell'algoritmo (volutamente minimali) ─────────────────

export type NodeId = string;

export interface TopoNode {
  id: NodeId;
}

/**
 * Arco del DAG. Semantica: `from` e' PREREQUISITO di `to`
 * ("from deve essere completato prima di poter sbloccare to").
 * Coincide con le colonne path_edges.from_node_id / path_edges.to_node_id.
 */
export interface TopoEdge {
  from: NodeId;
  to: NodeId;
}

export interface PathState {
  /** false => il grafo contiene un ciclo (non e' un DAG valido). */
  valid: boolean;
  /** Ordine topologico dei nodi (parziale se `valid` e' false). */
  order: NodeId[];
  /** Riga/strato di ogni nodo: cammino piu' lungo dalle radici (radici = 0). */
  layer: Record<NodeId, number>;
  /** true => tutti i prerequisiti del nodo sono completati. */
  unlocked: Record<NodeId, boolean>;
  /** Prerequisiti ancora da completare, per nodo (vuoto se sbloccato). */
  blockedBy: Record<NodeId, NodeId[]>;
}

// ─── Algoritmo di Kahn (un solo attraversamento) ────────────────────────────

export function computePathState(
  nodes: TopoNode[],
  edges: TopoEdge[],
  completion: ReadonlySet<NodeId>
): PathState {
  // Adiacenza (from -> [to]), in-degree e lista dei prerequisiti per nodo.
  const adj = new Map<NodeId, NodeId[]>();
  const indegree = new Map<NodeId, number>();
  const prereqs = new Map<NodeId, NodeId[]>();

  for (const n of nodes) {
    adj.set(n.id, []);
    indegree.set(n.id, 0);
    prereqs.set(n.id, []);
  }

  // Costruzione del grafo. Gli archi che puntano a nodi inesistenti vengono
  // ignorati in modo difensivo (robustezza contro dati incoerenti).
  for (const e of edges) {
    if (!adj.has(e.from) || !indegree.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
    indegree.set(e.to, indegree.get(e.to)! + 1);
    prereqs.get(e.to)!.push(e.from);
  }

  // Inizializzazione del layering e della coda con le radici (in-degree 0).
  const layer: Record<NodeId, number> = {};
  const queue: NodeId[] = [];
  for (const n of nodes) {
    layer[n.id] = 0;
    if (indegree.get(n.id) === 0) queue.push(n.id);
  }

  // Attraversamento topologico. Copia locale dell'in-degree cosi' da non
  // mutare la struttura calcolata (mantiene la funzione pura).
  const remaining = new Map(indegree);
  const order: NodeId[] = [];

  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    order.push(u);
    for (const v of adj.get(u)!) {
      // Longest-path layering: lo strato di v e' almeno strato(u) + 1.
      if (layer[u] + 1 > layer[v]) layer[v] = layer[u] + 1;
      const d = remaining.get(v)! - 1;
      remaining.set(v, d);
      if (d === 0) queue.push(v);
    }
  }

  // Se non abbiamo processato tutti i nodi, esiste un ciclo.
  const valid = order.length === nodes.length;

  // Frontiera sbloccata: un nodo e' sbloccato sse tutti i prerequisiti sono
  // completati. Le radici (nessun prerequisito) sono sbloccate da subito.
  const unlocked: Record<NodeId, boolean> = {};
  const blockedBy: Record<NodeId, NodeId[]> = {};
  for (const n of nodes) {
    const missing = prereqs.get(n.id)!.filter((p) => !completion.has(p));
    blockedBy[n.id] = missing;
    unlocked[n.id] = missing.length === 0;
  }

  return { valid, order, layer, unlocked, blockedBy };
}

/**
 * Helper di convenienza: true se il grafo e' un DAG valido (nessun ciclo).
 * Usato dall'editor del maestro al salvataggio (Iterazione B).
 */
export function isAcyclic(nodes: TopoNode[], edges: TopoEdge[]): boolean {
  return computePathState(nodes, edges, new Set()).valid;
}
