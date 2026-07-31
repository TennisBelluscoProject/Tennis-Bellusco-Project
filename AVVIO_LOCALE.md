# Avvio in locale

Guida passo passo per configurare ed eseguire l'applicazione Tennis Club Bellusco
sul proprio computer.

## 1. Prerequisiti

- **Node.js 20 o superiore** (il progetto è stato sviluppato con Node 24).
  Verifica la versione installata con:
  ```bash
  node -v
  ```
  Se non è installato, scaricalo da [nodejs.org](https://nodejs.org).
- **npm** (incluso con Node.js).
- Un progetto **Supabase** a cui collegarsi (vedi punto 3).

## 2. Installazione delle dipendenze

Dalla cartella del progetto, esegui:

```bash
npm install
```

Questo comando scarica tutte le librerie necessarie (cartella `node_modules`).

## 3. Configurazione delle variabili d'ambiente

L'app si collega a Supabase tramite due variabili d'ambiente.

1. Copia il file di esempio:
   ```bash
   cp .env.local.example .env.local
   ```
2. Apri `.env.local` e inserisci i valori del progetto Supabase:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<id-progetto>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<chiave-anon>
   ```

Dove trovare questi valori: nella dashboard di Supabase, in
**Project Settings > API**. La `URL` è l'indirizzo del progetto, la
`anon key` è la chiave pubblica del client.

> Nota: il file `.env.local` non viene incluso nel repository (contiene le chiavi
> di accesso). Per eseguire l'app è necessario crearlo come descritto sopra.

## 4. Avvio dell'applicazione

Avvia il server di sviluppo:

```bash
npm run dev
```

Apri il browser su [http://localhost:3000](http://localhost:3000).
L'app si ricarica automaticamente a ogni modifica del codice.

## 5. Build di produzione (opzionale)

Per generare ed eseguire la versione ottimizzata:

```bash
npm run build
npm run start
```

## Primo accesso e ruoli

- Gli utenti possono registrarsi dalla pagina di login. Dopo la verifica via email,
  l'allievo resta **in attesa di approvazione** finché un maestro non lo approva.
- Il ruolo (maestro o allievo) è memorizzato nel profilo utente nel database.
  Il primo account maestro va impostato manualmente da Supabase, modificando il
  campo `role` della tabella `profiles` su `maestro`.

## Configurazione di un nuovo progetto Supabase (solo se necessario)

Se ci si collega a un progetto Supabase nuovo e vuoto, vanno applicate le
migrazioni SQL presenti nella cartella `scripts`. Dalla dashboard di Supabase,
in **SQL Editor**, esegui nell'ordine:

1. `scripts/sql/2026_goal_templates.sql` (tabella dei template di obiettivi)
2. `scripts/sql/2026_kids_paths.sql` (Percorsi Kids: i 12 passi del Diario del Tennis)
3. `scripts/setup-avatars-bucket.sql` (bucket storage per le foto avatar e relative policy)

Va inoltre predisposta la struttura delle tabelle principali (`profiles`, `goals`,
`match_results`, `invite_links`) e il trigger `handle_new_user` che crea il profilo
alla registrazione. Se ci si collega al progetto Supabase già esistente del club,
questi passaggi non servono perché lo schema è già configurato.

## Percorsi Kids (i 12 passi)

La sezione **Catalogo > Percorsi Kids** e la scheda **12 passi** dell'allievo
richiedono la migrazione `scripts/sql/2026_kids_paths.sql`. Senza di essa il
percorso si disegna comunque, ma le spunte non vengono salvate.

Alcune note utili:

- Il CONTENUTO dei tre percorsi (208 obiettivi in tutto) sta nel codice, in
  `lib/kids/curriculum.ts`: e' materiale didattico FIT uguale per tutti gli
  allievi. Sul database finiscono solo le spunte.
- Se si aggiungono o tolgono obiettivi bisogna aggiornare anche la tabella
  `kids_level_totals` (usata dal server per validare il passaggio di livello).
  Il test `lib/kids/__tests__/progress.test.ts` fallisce apposta se i due
  valori divergono.
- La sezione si puo' nascondere agli utenti mettendo `KIDS_PATHS = false` in
  `lib/constants.ts`.

## Risoluzione dei problemi

- **Pagina bianca o errore di connessione**: verifica che `.env.local` esista e che
  le chiavi Supabase siano corrette.
- **La porta 3000 è occupata**: avvia su un'altra porta con
  `npm run dev -- -p 3001`.
- **Errori dopo aver cambiato dipendenze**: cancella `node_modules` e la cartella
  `.next`, poi ripeti `npm install`.
