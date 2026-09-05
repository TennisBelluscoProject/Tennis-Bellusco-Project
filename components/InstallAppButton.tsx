'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useInstallPrompt } from '@/lib/use-install-prompt';
import { useIsMobile } from '@/lib/hooks';

interface Props {
  /** Occupa tutta la larghezza (elenco delle impostazioni). */
  block?: boolean;
  className?: string;
}

/**
 * "Installa app": mette l'icona sulla schermata home in un tocco.
 *
 * Non si disegna quasi mai, ed e' giusto cosi'. Compare solo se ci sono TUTTE
 * e tre le condizioni: si sta su un telefono, il browser ha davvero offerto
 * l'installazione (`beforeinstallprompt`, vedi lib/use-install-prompt.ts) e
 * l'app non e' gia' installata. In pratica: Android, prima volta.
 *
 * Su iPhone non comparira' mai, perche' Safari non espone nessuna API di
 * installazione: li' l'unica strada resta Condividi → "Aggiungi a Home", e un
 * pulsante che non puo' mantenere la promessa e' peggio di nessun pulsante.
 */
export function InstallAppButton({ block, className }: Props) {
  const { canInstall, install } = useInstallPrompt();
  const isMobile = useIsMobile();

  if (!canInstall || !isMobile) return null;

  return (
    <Button
      variant="secondary"
      size="sm"
      block={block}
      className={className}
      onClick={install}
      icon={<Download size={15} strokeWidth={2.3} />}
    >
      Installa app
    </Button>
  );
}
