# Percorsi di Obiettivi (Skill Tree) — Iterazione B

L'Iterazione B completa la feature end-to-end: il maestro **disegna** un percorso
(validato contro i cicli con l'algoritmo di Kahn), lo **attiva** per un allievo
(materializzando i nodi come `goals`), e l'allievo lo **vive** dalla tab "Il mio
percorso" sbloccando i nodi man mano che li completa, con animazione di sblocco.

> Nessun test runner aggiunto (vitest escluso su tua richiesta). L'algoritmo
> resta verificabile manualmente: è una funzione pura in `lib/paths/topo.ts`.

---

## 1. Database (applicato via MCP)

Migrazione `paths_iteration_b_rpc`:

- **Indice anti-duplicati** `goals_student_pathnode_uidx` su `(student_id, path_node_id)`
  parziale (`where path_node_id is not null`): impedisce di materializzare due
  volte lo stesso nodo per lo stesso allievo.
- **RPC `activate_path(p_path_id, p_student_id)`** — `security definer`, solo
  maestri (`is_coach`). In transazione: crea la riga `student_paths` (idempotente
  via `on conflict`) e inserisce un `goal` con stato `planned` per ogni nodo del
  percorso non ancora materializzato per quell'allievo. Ritorna l'id di `student_paths`.
- **RPC `save_path_graph(p_path_id, p_nodes, p_edges)`** — `security definer`, solo
  maestri. In transazione: sostituisce nodi e archi del percorso (delete + insert).
  Gli id dei nodi sono generati lato client, così gli archi possono già
  referenziarli. Le due RPC hanno `execute` revocato a `public` e concesso solo a
  `authenticated`.

---

## 2. Repository (Repository Pattern)

- **`lib/repositories/path.repository.ts`** (`IPathRepository`): `list`, `getById`,
  `create`, `update`, `delete`, `getGraph` (nodi+archi), `saveGraph` (RPC).
- **`lib/repositories/student-path.repository.ts`** (`IStudentPathRepository`):
  `listActiveByStudent` (join `student_paths` + `paths`) e `activate` (RPC).
- **`lib/repositories/goal.repository.ts`**:
  - `listByStudent` ora filtra `path_node_id IS NULL` → il **Kanban mostra solo
    gli obiettivi liberi**.
  - nuovo `listByStudentPath(studentId, pathId)` → i goal materializzati di quel
    percorso (join `path_nodes!inner` sul `path_id`).
- **`lib/repositories/index.ts`**: nuove istanze `pathRepo`, `studentPathRepo` e
  re-export di interfacce/tipi.
- **`lib/database.types.ts`**: registrate le RPC in `Database['public']['Functions']`
  per mantenere `supabase.rpc(...)` type-safe.

L'algoritmo (Kahn) resta **fuori** dai repository e da React, in `lib/paths/topo.ts`.

---

## 3. Lato maestro — editor + attivazione

- **`components/PathEditor.tsx`**: editor a form. Si aggiungono nodi dal catalogo
  (`GoalTemplatePicker`, riuso) o personalizzati; per ogni nodo si scelgono i
  prerequisiti con chip multi-selezione. Gli archi `prerequisito → nodo` sono
  derivati. Mentre modifichi, **`isAcyclic` valida in tempo reale**: se compare un
  ciclo, il salvataggio è bloccato e appare l'avviso. Quando il grafo è valido,
  l'**anteprima auto-layout** mostra l'albero (stesso layering topologico della
  vista allievo). Al salvataggio: `pathRepo.create/update` (metadati) +
  `pathRepo.saveGraph` (nodi/archi via RPC).
- **`components/PathManager.tsx`**: lista percorsi, "Nuovo percorso", modifica,
  elimina e **"Attiva per allievo"** (modale con ricerca allievo →
  `studentPathRepo.activate`).
- **Collocazione**: dentro la tab **Catalogo**, con un selettore *Obiettivi /
  Percorsi* — sia su mobile (`app/coach/tabs/CatalogoTab.tsx`) sia su desktop
  (`app/coach/CoachDashboard.tsx`). La `BottomNav` mobile resta invariata.

---

## 4. Lato allievo — vista reale + azioni + sblocco

- **`app/student/PlayerView.tsx`**: la tab "Il mio percorso" ora carica i **dati
  reali** (lazy, all'apertura della tab): percorsi attivi
  (`studentPathRepo.listActiveByStudent`), grafo (`pathRepo.getGraph`) e goal
  materializzati (`goalRepo.listByStudentPath`). Se l'allievo ha più percorsi,
  un selettore in alto permette di scegliere. Se non ne ha, empty state.
  Azioni sul nodo: **Inizia** (`changeStatus → in_progress`), **slider di
  progresso** (`setProgress`), **Completa** (`changeStatus → completed`). Dopo
  ogni completamento i dati si ricaricano e l'algoritmo ricalcola la frontiera.
- **`components/PathTreeView.tsx`**: ora riceve `goalId` per nodo e le callback
  `onStart/onProgress/onComplete`. Quando un completamento sblocca nuovi nodi, il
  diff tra la frontiera precedente e quella nuova marca i nodi appena sbloccati
  con la classe **`.animate-unlock`** (keyframe `unlockPop` in `globals.css`).

---

## 5. Flusso end-to-end
1. Maestro → Catalogo › Percorsi → **Nuovo percorso** → aggiunge nodi e
   prerequisiti → (Kahn rifiuta i cicli) → **Crea percorso**.
2. Maestro → **Attiva per allievo** → sceglie l'allievo → i nodi diventano `goals`
   `planned` dell'allievo.
3. Allievo → tab **Il mio percorso** → vede l'albero; i nodi radice sono
   "Disponibili", gli altri "Bloccati".
4. Allievo apre un nodo disponibile → **Inizia** → aggiorna il **progresso** →
   **Completa**.
5. Il ricalcolo sblocca i nodi i cui prerequisiti sono ora completati → **animazione**.

---

## 6. ADR-9 — Modifiche ai percorsi già attivati
Le modifiche a un percorso (via `save_path_graph`) **sostituiscono** nodi e archi
del template. Per via del vincolo `goals.path_node_id ON DELETE SET NULL`:
- i goal già materializzati per gli allievi **non vengono distrutti**; se un nodo
  viene rimosso, il relativo goal torna a essere un **obiettivo libero** del Kanban;
- le modifiche strutturali valgono di fatto per le **nuove attivazioni**: chi ha
  già il percorso attivo non viene "ri-bloccato", perché la sua frontiera è
  calcolata sui goal che possiede.

Conseguenza pratica: rinominare/aggiungere nodi è sicuro; rimuovere un nodo già
assegnato lo declassa a obiettivo libero invece di cancellarlo.

---

## 7. File toccati in Iterazione B
Nuovi: `lib/repositories/path.repository.ts`,
`lib/repositories/student-path.repository.ts`, `components/PathEditor.tsx`,
`components/PathManager.tsx`.
Modificati: `lib/database.types.ts` (Functions), `lib/repositories/types.ts`,
`lib/repositories/goal.repository.ts`, `lib/repositories/index.ts`,
`components/PathTreeView.tsx` (azioni + animazione),
`app/student/PlayerView.tsx` (dati reali + azioni),
`app/coach/tabs/CatalogoTab.tsx` e `app/coach/CoachDashboard.tsx` (selettore
Percorsi), `app/globals.css` (keyframe `unlockPop`).
DB: migrazione `paths_iteration_b_rpc`.

Nota: `lib/paths/sample.ts` (dati di esempio dell'Iterazione A) non è più usato
dalla vista allievo, ora alimentata da dati reali; resta nel repo come riferimento.
