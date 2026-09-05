'use client';

import { useState } from 'react';
import { GoalTemplateManager } from '@/components/GoalTemplateManager';
import { PathManager } from '@/components/PathManager';
import { KidsPathCatalog } from '@/components/kids/KidsPathCatalog';
import { SectionSwitcher } from '@/components/UI';
import { KIDS_PATHS } from '@/lib/constants';
import { KIDS_PROGRAMS } from '@/lib/kids/curriculum';
import type { Profile } from '@/lib/database.types';

type CatalogView = 'obiettivi' | 'percorsi' | 'kids';

const VIEW_LABELS: Record<CatalogView, string> = {
  obiettivi: 'Obiettivi',
  percorsi: 'Percorsi',
  kids: 'Percorsi Kids',
};

interface Props {
  coachId: string;
  /** Apre la scheda di un allievo dalla lista progressi dei Percorsi Kids. */
  onOpenStudent?: (student: Profile) => void;
}

export function CatalogoTab({ coachId, onOpenStudent }: Props) {
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
          <div className="h-full px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
            <KidsPathCatalog onOpenStudent={onOpenStudent} />
          </div>
        )}
      </div>
    </div>
  );
}
