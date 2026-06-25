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

La guida completa per configurare e avviare l'app sul proprio computer si trova in
[AVVIO_LOCALE.md](AVVIO_LOCALE.md).

In sintesi:

```bash
npm install
cp .env.local.example .env.local   # poi inserisci le chiavi Supabase
npm run dev
```

L'app sarà disponibile su [http://localhost:3000](http://localhost:3000).

## Script disponibili

| Comando         | Descrizione                                  |
| --------------- | -------------------------------------------- |
| `npm run dev`   | Avvia il server di sviluppo                  |
| `npm run build` | Crea la build di produzione                  |
| `npm run start` | Avvia la build di produzione                 |
| `npm run lint`  | Esegue il linter (ESLint)                    |
