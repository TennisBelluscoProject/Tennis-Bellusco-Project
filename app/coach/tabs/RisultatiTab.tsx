'use client';

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
    <div className="px-4 py-5 animate-fade-in">
      <h2
        className="text-2xl font-bold text-gray-900 tracking-[-0.02em] mb-4"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Risultati Agonistici
      </h2>

      <div className="flex gap-2 mb-4">
        <FilterPill active={resultFilter === 'all'} onClick={() => onResultFilterChange('all')} label="Tutti" count={allMatches.length} />
        <FilterPill active={resultFilter === 'win'} onClick={() => onResultFilterChange('win')} label="Vittorie" count={winsCount} />
        <FilterPill active={resultFilter === 'loss'} onClick={() => onResultFilterChange('loss')} label="Sconfitte" count={lossesCount} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🏆" title="Nessun match" message="Non ci sono match registrati." />
      ) : (
        <div className="flex flex-col gap-2.5 stagger-children">
          {filtered.map((m) => (
            <CompactMatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}
