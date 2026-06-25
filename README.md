# Tennis Club Bellusco

Applicazione web per la gestione degli allievi e dei maestri del Tennis Club Bellusco 2012.
Permette al maestro di seguire il percorso di ogni allievo (obiettivi, risultati delle partite,
note tecniche) e all'allievo di consultare i propri obiettivi e inserire i propri risultati.

L'app è una PWA (installabile da mobile) costruita con Next.js e Supabase.

## Funzionalità principali

L'accesso e le funzioni disponibili dipendono dal ruolo dell'utente.

### Maestro
- Approva o rifiuta le richieste di registrazione degli allievi
- Gestisce l'anagrafica degli allievi (dati, livello, ranking)
- Assegna e monitora gli obiettivi di ogni allievo su una board in stile Kanban
  (categorie: tecnica, tattica, fisico, mente, agonismo)
- Crea e riutilizza template di obiettivi per livello (Delfino, Cerbiatto, Coccodrillo)
- Registra e commenta i risultati delle partite
- Vede una panoramica generale del club (allievi, obiettivi, partite, percentuale vittorie)

### Allievo
- Si registra e attende l'approvazione del maestro
- Consulta i propri obiettivi e ne segue lo stato di avanzamento
- Inserisce i risultati delle proprie partite
- Gestisce il proprio profilo e la foto avatar

## Stack tecnologico

- **Next.js 16** (App Router) e **React 19**
- **TypeScript**
- **Tailwind CSS 4**
- **Supabase** (autenticazione, database PostgreSQL, storage per gli avatar)
- **lucide-react** per le icone

## Struttura del progetto

```
app/              Pagine e route (App Router di Next.js)
  coach/          Dashboard e schede del maestro
  student/        Dashboard, profilo e vista giocatore dell'allievo
  login/          Login, registrazione e verifica OTP
  auth/callback/  Gestione del redirect di autenticazione Supabase
components/       Componenti UI riutilizzabili (Kanban, form, card, libreria UI)
contexts/         AuthContext: stato di sessione e profilo utente
lib/              Client Supabase, tipi del database, costanti e utility
public/           Asset statici, icone PWA e service worker
scripts/          Script e migrazioni SQL per il setup di Supabase
```

## Avvio in locale

Segui questi passaggi in ordine. La prima volta vanno eseguiti tutti; dalla
seconda in poi, di norma, basta il passo 5 (`npm run dev`).

### 1. Installare Node.js

Serve **Node.js 20 o superiore** (include `npm`). Scaricalo da
[nodejs.org](https://nodejs.org) e verifica che sia installato:

```bash
node -v
```

### 2. Scaricare il progetto

Clona il repository (oppure scarica lo ZIP da GitHub ed estrailo), poi entra
nella cartella:

```bash
git clone https://github.com/TennisBelluscoProject/Tennis-Bellusco-Project.git
cd Tennis-Bellusco-Project
```

### 3. Installare le dipendenze

```bash
npm install
```

Questo comando scarica nella cartella `node_modules` tutte le librerie usate dal
progetto (Next.js, React, Supabase, ecc.). Va eseguito **la prima volta** e
ogni volta che le dipendenze cambiano. Senza questo passo `npm run dev` non
funziona.

### 4. Configurare le variabili d'ambiente

L'app si collega a Supabase tramite due chiavi. Copia il file di esempio e
inserisci i valori del progetto Supabase:

```bash
cp .env.local.example .env.local
```

Apri `.env.local` e compila:

```
NEXT_PUBLIC_SUPABASE_URL=https://<id-progetto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chiave-anon>
```

I valori si trovano nella dashboard di Supabase, in **Project Settings > API**.
Il file `.env.local` non è incluso nel repository (contiene le chiavi), quindi
va creato come sopra.

### 5. Avviare l'app

```bash
npm run dev
```

Apri il browser su [http://localhost:3000](http://localhost:3000). L'app si
ricarica da sola a ogni modifica del codice. Per fermarla, premi `Ctrl+C` nel
terminale.

> Per la configurazione di un progetto Supabase nuovo (creazione tabelle,
> migrazioni SQL, bucket avatar) e per la risoluzione dei problemi più comuni,
> vedi la guida estesa in [AVVIO_LOCALE.md](AVVIO_LOCALE.md).

## Script disponibili

| Comando         | Descrizione                                  |
| --------------- | -------------------------------------------- |
| `npm run dev`   | Avvia il server di sviluppo                  |
| `npm run build` | Crea la build di produzione                  |
| `npm run start` | Avvia la build di produzione                 |
| `npm run lint`  | Esegue il linter (ESLint)                    |
