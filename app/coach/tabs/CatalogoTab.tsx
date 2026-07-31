'use client';

import { useState } from 'react';
import { GoalTemplateManager } from '@/components/GoalTemplateManager';
import { PathManager } from '@/components/PathManager';
import { KidsPathCatalog } from '@/components/kids/KidsPathCatalog';
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
      <div className="shrink-0 flex gap-2 px-4 pt-1 pb-3 overflow-x-auto scrollbar-hidden">
        {views.map((v) => {
          const isActive = view === v;
          // La sezione Kids usa il rosso del Diario per distinguersi dal
          // catalogo "classico" (blu).
          const activeColor =
            v === 'kids' ? KIDS_PROGRAMS.DELFINO.colors.accent : 'var(--club-blue)';
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              className="shrink-0 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors"
              style={{
                background: isActive ? activeColor : '#FFFFFF',
                borderColor: isActive ? activeColor : '#E5E7EB',
                color: isActive ? '#FFFFFF' : '#6B7280',
              }}
            >
              {VIEW_LABELS[v]}
            </button>
          );
        })}
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
