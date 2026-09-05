'use client';

import { LogOut } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { IconButton } from '@/components/ui/Button';
import { AnimatedThemeToggler } from '@/components/ui/AnimatedThemeToggler';

interface Props {
  onLogout: () => void;
}

/* ─────────────────────────────────────────────────────────────────────────
   La barra in alto del telefono.

   Ha le stesse tre cose della barra da schermo largo — marchio, interruttore
   del tema, uscita — perche' non c'e' motivo per cui la scelta chiaro/scuro
   debba esistere solo davanti a una tastiera: e' anzi sul telefono che serve
   di piu', visto che e' li' che si apre l'app di sera.

   Colori tutti dai token. Prima erano scritti a mano (`bg-white/98`,
   `border-gray-100/80`, `text-gray-500`): la barra restava BIANCA anche a
   tema scuro, cioe' una striscia accesa sopra un'app spenta — e mettere qui
   l'interruttore senza sistemare quello avrebbe solo reso il difetto piu'
   facile da trovare. Il sottotitolo, poi, usava `--muted`, che e' un colore
   di SUPERFICIE, non di testo: grigio chiarissimo su bianco, quasi invisibile
   anche di giorno.

   Il marchio e' quello vettoriale e non piu' il PNG per lo stesso motivo:
   il logo raster ha la scritta blu scuro, che su fondo scuro sparisce. Il
   segno tracciato prende il colore corrente e regge tutti e due i temi con un
   file solo — e' gia' la scelta fatta sulla barra da schermo largo.
   ───────────────────────────────────────────────────────────────────────── */

export function MobileHeader({ onLogout }: Props) {
  return (
    // `viewportFit: cover` + barra di stato traslucida (layout.tsx) fanno
    // arrivare il contenuto fin sotto l'orologio di sistema. Il rientro in
    // alto lo mette la barra, primo elemento della pagina, con la stessa
    // `--safe-top` che usa l'header condiviso.
    <header
      className="sticky top-0 z-30 glass border-b border-border"
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo size={30} />
          <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
          <span className="truncate text-[11.5px] text-muted-foreground">Dashboard Maestro</span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <AnimatedThemeToggler size={36} />
          <IconButton
            label="Esci"
            onClick={onLogout}
            size={36}
            icon={<LogOut size={17} />}
            className="hover:text-destructive hover:bg-destructive-soft"
          />
        </div>
      </div>
    </header>
  );
}
