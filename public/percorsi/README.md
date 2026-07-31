# Immagini degli avatar dei percorsi

Qui vanno le grafiche degli avatar (mascotte) del "Percorso avventura".

STATO: le 9 immagini (3 mondi x 3 stadi) sono presenti e gia' collegate in
`lib/paths/worlds.ts`. Se un file venisse rimosso, basta togliere la relativa
riga `image` e l'app torna al placeholder (emoji su piastra colorata).

## Convenzione dei file

Un'immagine per ogni combinazione mondo x stadio evolutivo
(principio dei tre livelli: Cucciolo -> Ragazzo -> Adulto):

```
public/percorsi/
  delfino/
    cucciolo.png
    ragazzo.png
    adulto.png
  cerbiatto/
    cucciolo.png
    ragazzo.png
    adulto.png
  coccodrillo/
    cucciolo.png
    ragazzo.png
    adulto.png
```

Formato consigliato: PNG con sfondo trasparente, quadrato, almeno 256x256.

IMPORTANTE: i nomi dei file devono essere TUTTI MINUSCOLI. In locale Windows
non fa differenza, ma in produzione (Vercel / Linux) il filesystem e'
case-sensitive e un `Ragazzo.png` darebbe 404.

## Come sostituirle / aggiungerne

Aprire `lib/paths/worlds.ts` e valorizzare il campo `image` di ciascun tier,
ad esempio per il Delfino:

```ts
tiers: [
  { id: 'cucciolo', label: 'Cucciolo', image: '/percorsi/delfino/cucciolo.png', ... },
  { id: 'ragazzo',  label: 'Ragazzo',  image: '/percorsi/delfino/ragazzo.png',  ... },
  { id: 'adulto',   label: 'Adulto',   image: '/percorsi/delfino/adulto.png',   ... },
],
```

Nessun componente va modificato: `MascotBadge` (in
`components/PathAdventureView.tsx`) usa l'immagine se presente, altrimenti
il placeholder.

In futuro, con lo stesso meccanismo, si potranno aggiungere anche sfondi o
elementi grafici di scenario per ogni mondo.
