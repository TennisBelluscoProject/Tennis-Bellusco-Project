'use client';

import { Users } from 'lucide-react';
import { SearchBar, Spinner, EmptyState } from '@/components/UI';
import type { Profile } from '@/lib/database.types';
import { getActivityDot } from '@/lib/utils';
import { StudentRow } from '../components/StudentRow';

interface Props {
  loading: boolean;
  students: Profile[];
  studentActivity: Record<string, Date | null>;
  studentStats: Record<string, { matches: number; wins: number; goals: number }>;
  search: string;
  onSearchChange: (s: string) => void;
  onSelect: (student: Profile) => void;
}

export function AllieviTab({
  loading,
  students,
  studentActivity,
  studentStats,
  search,
  onSearchChange,
  onSelect,
}: Props) {
  const total = students.length;
  const filtered = students.filter((s) =>
    `${s.full_name} ${s.email ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="px-4 pt-5 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className="text-2xl font-bold text-gray-900 tracking-[-0.02em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Allievi
            </h2>
            <p className="text-[12px] text-gray-500 mt-0.5">
              {total} {total === 1 ? 'attivo' : 'attivi'}
            </p>
          </div>
        </div>

        <SearchBar value={search} onChange={onSearchChange} placeholder="Cerca allievo..." />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={40} strokeWidth={1.5} />}
            title="Nessun allievo"
            message={search ? 'Nessun risultato per la ricerca.' : 'Nessun allievo approvato. Le richieste di registrazione le trovi nella tab Richieste.'}
          />
        ) : (
          <div className="flex flex-col gap-2.5 stagger-children">
            {filtered.map((s) => {
              const dot = getActivityDot(studentActivity[s.id] ?? null);
              const stats = studentStats[s.id] ?? { matches: 0, wins: 0, goals: 0 };
              return (
                <StudentRow
                  key={s.id}
                  student={s}
                  dot={dot}
                  stats={stats}
                  lastActivity={studentActivity[s.id] ?? null}
                  onClick={() => onSelect(s)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
