'use client';

import { useState } from 'react';
import { GoalTemplateManager } from '@/components/GoalTemplateManager';
import { PathManager } from '@/components/PathManager';
import { KidsPathCatalog } from '@/components/kids/KidsPathCatalog';
import { SectionSwitcher } from '@/components/UI';
import { KIDS_PATHS } from '@/lib/constants';
import { KIDS_PROGRAMS } from '@/lib/kids/curriculum';

type CatalogView = 'obiettivi' | 'percorsi' | 'kids';

const VIEW_LABELS: Record<CatalogView, string> = {
  obiettivi: 'Obiettivi',
  percorsi: 'Percorsi',
  kids: 'Percorsi Kids',
};

interface Props {
  coachId: string;
}

export function CatalogoTab({ coachId }: Props) {
  const [view, setView] = useState<CatalogView>('obiettivi');

  const views: CatalogView[] = KIDS_PATHS
    ? ['obiettivi', 'percorsi', 'kids']
    : ['obiettivi', 'percorsi'];

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="shrink-0 px-4 pt-1 pb-3">
        <SectionSwitcher
          tabs={views.map((v) => ({
            id: v,
            label: VIEW_LABELS[v],
            // La sezione Kids usa il rosso del Diario per distinguersi dal
            // catalogo "classico" (blu).
            color: v === 'kids' ? KIDS_PROGRAMS.DELFINO.colors.accent : 'var(--primary)',
          }))}
          active={view}
          onChange={(v) => setView(v as CatalogView)}
        />
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {view === 'obiettivi' ? (
          <GoalTemplateManager coachId={coachId} />
        ) : view === 'percorsi' ? (
          <div className="h-full px-4">
            <PathManager coachId={coachId} />
          </div>
        ) : (
          // Niente rientro in fondo: la BottomNav sta NEL FLUSSO (e' l'ultima
          // riga della colonna alta quanto il viewport), quindi compensarne
          // l'altezza qui lasciava solo una fascia grigia sotto la mappa.
          <div className="h-full px-4">
            <KidsPathCatalog coachId={coachId} />
          </div>
        )}
      </div>
    </div>
  );
}
