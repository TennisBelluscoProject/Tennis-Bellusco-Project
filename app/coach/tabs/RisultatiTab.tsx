'use client';

import { Trophy } from 'lucide-react';
import { Spinner, EmptyState } from '@/components/UI';
import type { MatchResultRow } from '@/lib/database.types';
import { FilterPill } from '../components/Pills';
import { CompactMatchCard } from '../components/CompactMatchCard';

interface Props {
  loading: boolean;
  allMatches: MatchResultRow[];
  resultFilter: 'all' | 'win' | 'loss';
  onResultFilterChange: (f: 'all' | 'win' | 'loss') => void;
}

export function RisultatiTab({ loading, allMatches, resultFilter, onResultFilterChange }: Props) {
  const filtered = allMatches.filter((m) => {
    if (resultFilter === 'win') return m.result === 'win';
    if (resultFilter === 'loss') return m.result === 'loss';
    return true;
  });
  const winsCount = allMatches.filter((m) => m.result === 'win').length;
  const lossesCount = allMatches.filter((m) => m.result === 'loss').length;

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="px-4 pt-5 pb-4 shrink-0">
        <h2
          className="text-2xl font-bold text-gray-900 tracking-[-0.02em] mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Risultati Agonistici
        </h2>

        <div className="flex gap-2">
          <FilterPill active={resultFilter === 'all'} onClick={() => onResultFilterChange('all')} label="Tutti" count={allMatches.length} />
          <FilterPill active={resultFilter === 'win'} onClick={() => onResultFilterChange('win')} label="Vittorie" count={winsCount} />
          <FilterPill active={resultFilter === 'loss'} onClick={() => onResultFilterChange('loss')} label="Sconfitte" count={lossesCount} />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Trophy size={40} strokeWidth={1.5} />} title="Nessun match" message="Non ci sono match registrati." />
        ) : (
          <div className="flex flex-col gap-2.5 stagger-children">
            {filtered.map((m) => (
              <CompactMatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
