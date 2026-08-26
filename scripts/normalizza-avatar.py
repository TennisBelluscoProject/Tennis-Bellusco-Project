#!/usr/bin/env python3
"""
Normalizza gli avatar dei Percorsi Kids (public/percorsi/<mondo>/<stadio>.png).

IL PROBLEMA
Le nove grafiche sono tutte su tela 500x500, ma il soggetto dentro la tela
occupa porzioni molto diverse: il cerbiatto cucciolo riempie l'89% del lato,
il coccodrillo cucciolo il 47%. Renderizzate con `object-contain` dentro un
riquadro quadrato della stessa dimensione, il coccodrillo appare grande la
meta' degli altri. A questo si somma la FORMA: un animale piatto (2.5:1) in un
riquadro quadrato tocca i bordi in larghezza ma resta basso, quindi anche
ritagliato bene "pesa" meno a occhio di un animale alto.

LA REGOLA
Non si normalizza sul lato lungo (lascerebbe piccoli i soggetti piatti) ma
sull'AREA: ogni soggetto viene riscalato perche' la sua radice di (larghezza x
altezza) valga TARGET. Chi sforerebbe la tela viene limitato a MAX_FRAZIONE
del lato: e' il caso del coccodrillo cucciolo, che si ferma poco sotto la
norma invece di debordare.

I soggetti vengono poi appoggiati sulla STESSA linea di terra (in basso, con un
margine): cosi' l'ombra ellittica che il codice disegna sotto la mascotte cade
dove stanno davvero le zampe, invece che a mezz'aria.

USO
    python scripts/normalizza-avatar.py [percorso/di/public/percorsi]

Senza argomenti cerca `public/percorsi` a partire dalla posizione dello
script, quindi funziona da qualunque cartella lo si lanci.

Gli originali vengono salvati in <mondo>/originali/ prima di sovrascrivere, e
se quella cartella esiste gia' si riparte SEMPRE da li': lo script e' quindi
idempotente e si puo' rilanciare cambiando TARGET senza degradare le immagini
di generazione in generazione.

Richiede Pillow:  pip install Pillow
"""

from __future__ import annotations

import math
import shutil
import sys
from pathlib import Path

from PIL import Image

# ─── Parametri ──────────────────────────────────────────────────────────────

MONDI = ("cerbiatto", "coccodrillo", "delfino")
STADI = ("cucciolo", "ragazzo", "adulto")

# Area bersaglio, espressa come radice di (larghezza x altezza) del soggetto.
# 370 e' circa la mediana delle nove grafiche: cosi' le gia' buone si toccano
# appena e si muovono solo quelle fuori norma.
TARGET = 370.0

# Il soggetto non puo' superare questa frazione del lato della tela.
MAX_FRAZIONE = 0.96

# Margine sotto la linea di terra, in frazione del lato.
MARGINE_TERRA = 0.03


def riquadro_contenuto(im: Image.Image) -> tuple[int, int, int, int]:
    """Bounding box del soggetto, cioe' dei pixel non trasparenti."""
    bb = im.split()[3].getbbox()
    if bb is None:
        raise ValueError("immagine completamente trasparente")
    return bb


def normalizza(src: Path, dst: Path) -> str:
    im = Image.open(src).convert("RGBA")
    lato_w, lato_h = im.size
    bb = riquadro_contenuto(im)
    soggetto = im.crop(bb)
    lw, lh = soggetto.size

    area_attuale = math.sqrt(lw * lh)
    fattore = TARGET / area_attuale

    # Tetto: il soggetto deve restare dentro la tela.
    tetto = min(lato_w * MAX_FRAZIONE / lw, lato_h * MAX_FRAZIONE / lh)
    limitato = fattore > tetto
    fattore = min(fattore, tetto)

    nw, nh = max(1, round(lw * fattore)), max(1, round(lh * fattore))
    soggetto = soggetto.resize((nw, nh), Image.LANCZOS)

    # Centrato in orizzontale, appoggiato in basso: stessa linea di terra per
    # tutti, cosi' l'ombra sotto la mascotte cade sulle zampe.
    fuori = Image.new("RGBA", (lato_w, lato_h), (0, 0, 0, 0))
    x = (lato_w - nw) // 2
    y = lato_h - nh - round(lato_h * MARGINE_TERRA)
    fuori.paste(soggetto, (x, max(0, y)), soggetto)

    dst.parent.mkdir(parents=True, exist_ok=True)
    fuori.save(dst, "PNG", optimize=True)

    area_finale = math.sqrt(nw * nh)
    nota = " (limitato dalla tela)" if limitato else ""
    return (
        f"{lw}x{lh} area {area_attuale:.0f}  ->  "
        f"{nw}x{nh} area {area_finale:.0f}  x{fattore:.2f}{nota}"
    )


def radice_predefinita() -> Path:
    """
    `public/percorsi` cercata a partire dallo SCRIPT, non dalla cartella da cui
    lo si lancia: lo script sta in `scripts/`, quindi il repo e' un livello
    sopra. Un default relativo alla working directory funzionava solo se ci si
    trovava gia' nella radice del progetto.
    """
    return Path(__file__).resolve().parent.parent / "public" / "percorsi"


def main() -> int:
    radice = Path(sys.argv[1]) if len(sys.argv) > 1 else radice_predefinita()
    if not radice.is_dir():
        print(f"Cartella non trovata: {radice}", file=sys.stderr)
        print(
            "Passa il percorso come argomento, es.\n"
            "  python scripts/normalizza-avatar.py C:/.../public/percorsi",
            file=sys.stderr,
        )
        return 1

    print(f"Normalizzo gli avatar in {radice}\n")

    for mondo in MONDI:
        cartella = radice / mondo
        if not cartella.is_dir():
            print(f"  salto {mondo}: cartella assente")
            continue
        originali = cartella / "originali"

        for stadio in STADI:
            corrente = cartella / f"{stadio}.png"
            backup = originali / f"{stadio}.png"

            if backup.exists():
                # Si riparte sempre dall'originale: rilanciare lo script non
                # riscala un'immagine gia' riscalata.
                sorgente = backup
            elif corrente.exists():
                originali.mkdir(parents=True, exist_ok=True)
                shutil.copy2(corrente, backup)
                sorgente = backup
            else:
                print(f"  manca {mondo}/{stadio}.png")
                continue

            esito = normalizza(sorgente, corrente)
            print(f"  {mondo}/{stadio}.png  {esito}")

    print("\nFatto. Gli originali sono in <mondo>/originali/.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
