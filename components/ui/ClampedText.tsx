'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────────────────
   Testo tagliato a N righe, con il resto raggiungibile.

   Il taglio a righe fisse serve a tenere in ordine una griglia di card: senza,
   basta una descrizione lunga per far crescere tutta la riga. Il difetto e'
   che il testo oltre la soglia diventa IRRAGGIUNGIBILE — finiva in tre
   puntini e non c'era modo di leggerlo, in nessun punto dell'app.

   Perche' non un fumetto al passaggio del mouse, che era la prima idea: su
   telefono il mouse non c'e', e quelle card si guardano soprattutto da
   telefono. Un fumetto avrebbe risolto il problema solo per meta' delle
   persone.

   Qui invece il testo si APRE, con un tocco o un clic, e si richiude. Il
   comando compare SOLO quando serve davvero: si misura se il testo sfora
   (`scrollHeight` contro `clientHeight`) e, se ci sta tutto, non si aggiunge
   niente — nessun "mostra tutto" sotto una riga e mezza di descrizione.

   ATTENZIONE: rende un <button>, quindi non va messo dentro un altro
   <button> (HTML non ammette il pulsante annidato, e il browser sbroglia il
   markup in modi imprevedibili). Nelle card che sono gia' interamente
   cliccabili la strada giusta e' un'altra: dare al testo lo spazio che gli
   serve, come fa la card dei percorsi Kids.
   ───────────────────────────────────────────────────────────────────────── */

interface Props {
  children: ReactNode;
  /** Righe visibili da chiuso. */
  lines?: number;
  className?: string;
  /** Etichette del comando. */
  moreLabel?: string;
  lessLabel?: string;
}

export function ClampedText({
  children,
  lines = 2,
  className,
  moreLabel = 'Mostra tutto',
  lessLabel = 'Riduci',
}: Props) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [sfora, setSfora] = useState(false);
  const [aperto, setAperto] = useState(false);

  const misura = useCallback(() => {
    const el = ref.current;
    // Da aperto non c'e' niente da misurare: il taglio non e' applicato e le
    // due altezze coinciderebbero sempre, cancellando il comando di chiusura.
    if (!el || aperto) return;
    setSfora(el.scrollHeight - el.clientHeight > 1);
  }, [aperto]);

  useEffect(() => {
    misura();
    const el = ref.current;
    if (!el) return;

    // La larghezza cambia con le colonne della griglia, e a larghezza diversa
    // lo stesso testo puo' passare da "ci sta" a "sfora".
    const ro = new ResizeObserver(misura);
    ro.observe(el);

    // I caratteri web arrivano dopo il primo disegno: fino a quel momento si
    // misura il ripiego di sistema, che ha metriche diverse.
    let vivo = true;
    document.fonts?.ready.then(() => {
      if (vivo) misura();
    });

    return () => {
      vivo = false;
      ro.disconnect();
    };
  }, [misura, children]);

  return (
    <span className="flex flex-col items-start gap-0.5">
      <p
        ref={ref}
        className={className}
        style={
          aperto
            ? undefined
            : {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: lines,
                overflow: 'hidden',
              }
        }
      >
        {children}
      </p>

      {(sfora || aperto) && (
        <button
          type="button"
          aria-expanded={aperto}
          onClick={() => setAperto((v) => !v)}
          className={cn(
            'text-[11px] font-semibold text-muted-foreground hover:text-foreground',
            'transition-colors duration-[var(--dur-fast)] rounded-[var(--radius-xs)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]'
          )}
        >
          {aperto ? lessLabel : moreLabel}
        </button>
      )}
    </span>
  );
}
