# Percorsi di Obiettivi (Skill Tree) — Iterazione A

Documento di accompagnamento alla feature **Percorsi**: un percorso è un grafo
diretto aciclico (DAG) di obiettivi-tipo (nodi = competenze, archi =
prerequisiti). Lo stato bloccato/sbloccato di ogni nodo **non è salvato**: viene
**calcolato** attraversando il grafo con l'algoritmo di **Kahn** (ordinamento
topologico, complessità **O(V+E)**), che è l'algoritmo "esibito" del progetto.

Questa è l'**Iterazione A**: schema dati sul DB + algoritmo puro + vista allievo
in **sola lettura** su dati di esempio. Attivazione, materializzazione dei goal,
editor del maestro e azioni reali arrivano nell'Iterazione B.

---

## 1. Modifiche al database (Supabase / PostgreSQL)

Applicate direttamente via MCP come migrazioni `paths_skill_tree_iteration_a` e
`paths_harden_trigger_search_path`. Copia versionata in `scripts/sql/2026_paths.sql`.

### Tabelle nuove

| Tabella | Ruolo | Note |
|---|---|---|
| `paths` | Il percorso (template, lato maestro) | `difficulty` riusa i livelli `DELFINO/CERBIATTO/COCCODRILLO`; trigger `updated_at` |
| `path_nodes` | I nodi del DAG (competenze) | `goal_template_id` opzionale (nodo da catalogo o custom); `category` per il colore |
| `path_edges` | Gli archi del DAG (prerequisiti) | `from_node_id` = prerequisito, `to_node_id` = dipendente; `unique(from,to)` + niente self-loop |
| `student_paths` | Istanza: percorso attivato per un allievo | `unique(student_id, path_id)` |

### Colonna aggiunta

- `goals.path_node_id uuid NULL` → FK a `path_nodes(id)` con **`ON DELETE SET NULL`**.
  - `NULL` = obiettivo "libero" del Kanban (comportamento attuale, invariato).
  - valorizzato = obiettivo materializzato da un nodo di percorso.
  - `SET NULL`: se il maestro cancella un nodo, il goal già assegnato all'allievo
    **non viene distrutto**, torna semplicemente a essere un obiettivo libero.

### Sicurezza (RLS)

Stesso schema di `goal_templates`: **leggono** tutti gli utenti autenticati,
**scrivono** solo i maestri (helper esistente `public.is_coach(auth.uid())`).
Per `student_paths` l'allievo vede solo i propri record; il maestro vede e
gestisce tutto. Totale: 8 policy.

---

## 2. File aggiunti

### `lib/paths/topo.ts` — l'algoritmo (cuore della feature)
Funzione **pura** `computePathState(nodes, edges, completion)` che con **un solo
attraversamento** in ordine topologico (Kahn) produce:

1. **Validazione**: calcola l'in-degree, consuma le radici (in-degree 0). Se i
   nodi processati sono meno di `|V|` → c'è un **ciclo** → `valid = false`.
   (In Iterazione B l'editor del maestro userà questo per rifiutare i cicli.)
2. **Layering**: `layer[v] = max(layer[prerequisiti]) + 1`, radici = 0. È il
   cammino più lungo nel DAG e dà la **riga Y** di ogni nodo nel disegno.
3. **Frontiera sbloccata**: un nodo è sbloccato se e solo se **tutti** i suoi
   prerequisiti sono `completed`; `blockedBy[v]` elenca quelli mancanti (per il
   messaggio "Completa X e Y per sbloccare").

Complessità **O(V+E)** in tempo e spazio. Nessun import di Supabase o React →
testabile e riusabile su qualunque frontend. Esporta anche `isAcyclic()`.

### `lib/paths/sample.ts` — dati di esempio
Un DAG con biforcazione (`SAMPLE_PATH`) usato solo dall'anteprima, scelto per
mostrare layering, frontiera sbloccata e i quattro stati visivi del nodo.

### `components/PathTreeView.tsx` — la vista skill tree (sola lettura)
Componente **presentazionale puro** (sullo stile di `KanbanBoard`, nessuna
dipendenza dal data layer). Riceve nodi/archi/stati via props e:
- chiama `computePathState` a ogni render (Kanban e Percorso = due viste degli
  stessi dati);
- dispone i nodi su **strati verticali** (Y dal layering), mobile-first;
- disegna i **connettori SVG** dei prerequisiti (tratteggiati e grigi se il nodo
  di arrivo è ancora bloccato);
- colora i nodi con i colori del club + `CATEGORY_CONFIG`:
  **Bloccato** (grigio, lucchetto, bordo tratteggiato), **Disponibile** (bordo
  rosso club + "Inizia"), **In corso** (barra di progress), **Completato**
  (verde, trofeo);
- header con **barra di avanzamento** del percorso e **badge difficoltà**;
- tap su un nodo → **bottom sheet** con descrizione, prerequisiti mancanti e
  azione (in anteprima l'azione è disabilitata).

### `scripts/sql/2026_paths.sql`
Copia versionata e idempotente della migrazione applicata via MCP.

---

## 3. File modificati

### `lib/database.types.ts`
- Aggiunte le interfacce di dominio `Path`, `PathNode`, `PathEdge`, `StudentPath`.
- Aggiunta la colonna `path_node_id: string | null` a `Goal`.
- Registrate le 4 tabelle (con relativi `Insert`/`Update`) nel tipo `Database`,
  così il client Supabase resta type-safe.

### `lib/constants.ts`
- Aggiunto il feature-flag **`PATHS_PREVIEW`** (`true`). Controlla la visibilità
  della tab "Il mio percorso". Mettilo a `false` per nasconderla agli utenti
  reali finché l'Iterazione B non è pronta.

### `app/student/PlayerView.tsx`
- Aggiunta la terza tab **"Il mio percorso"** (visibile solo se `PATHS_PREVIEW`),
  che monta `PathTreeView` con i dati di esempio in modalità anteprima.
- Il FAB (pulsante "+") è nascosto in modalità percorso, perché la vista è in
  sola lettura in questa iterazione.

---

## 4. Come provarla
1. Avvia l'app (`npm run dev`) e accedi come allievo (o apri un allievo dal
   profilo maestro).
2. Nella scheda dell'allievo compare la tab **"Il mio percorso"**.
3. Vedrai l'albero di esempio: un nodo completato, uno in corso, quelli
   sbloccati con "Inizia" e quelli bloccati col lucchetto. Tocca un nodo
   bloccato per vedere quali prerequisiti completare.

Per nascondere la tab: in `lib/constants.ts` imposta `PATHS_PREVIEW = false`.

---

## 5. Decisioni architetturali (ADR)
- **L'algoritmo vive fuori dal Repository Pattern e da React** (`lib/paths/`),
  coerentemente con i principi "Information hiding" e "Cohesion" di
  `ARCHITECTURE.txt`. Kanban e Percorso sono due viste degli stessi dati.
- **`goals.path_node_id` con `ON DELETE SET NULL`**: le modifiche a un percorso
  non devono mai distruggere il lavoro già fatto da un allievo. Un nodo
  cancellato declassa il goal a obiettivo libero, non lo elimina.
- **Stato bloccato/sbloccato calcolato, non salvato**: è sempre coerente col
  grafo e con i nodi completati, senza colonne ridondanti da mantenere.

---

## 6. Cosa resta per l'Iterazione B
- Repository `IPathRepository` e `IStudentPathRepository` (CRUD + `getPathGraph`,
  attivazione, lista percorsi attivi).
- Estensione di `IGoalRepository`: `listByStudentPath()` e filtro
  `path_node_id IS NULL` su `listByStudent` (per separare Kanban e percorso).
- **Attivazione**: materializzare i nodi del percorso in righe `goals`
  (status `planned`) per l'allievo.
- **Editor del maestro** (form con multiselect dei prerequisiti): al salvataggio
  Kahn valida e rifiuta i cicli; auto-layout di anteprima.
- Azioni reali sul nodo (riuso di `GoalForm` e dello slider) + animazione di
  sblocco quando un nodo viene completato.
- Sostituzione dei dati di esempio con i dati reali e accensione stabile della tab.
