'use client';

import { useState } from 'react';
import { GoalTemplateManager } from '@/components/GoalTemplateManager';
import { PathManager } from '@/components/PathManager';

interface Props {
  coachId: string;
}

export function CatalogoTab({ coachId }: Props) {
  const [view, setView] = useState<'obiettivi' | 'percorsi'>('obiettivi');

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="shrink-0 flex gap-2 px-4 pt-1 pb-3">
        {(['obiettivi', 'percorsi'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors ${
              view === v
                ? 'bg-[var(--club-blue)] text-white border-[var(--club-blue)]'
                : 'bg-white text-gray-500 border-gray-200'
            }`}
          >
            {v === 'obiettivi' ? 'Obiettivi' : 'Percorsi'}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {view === 'obiettivi' ? (
          <GoalTemplateManager coachId={coachId} />
        ) : (
          <div className="h-full px-4">
            <PathManager coachId={coachId} />
          </div>
        )}
      </div>
    </div>
  );
}
