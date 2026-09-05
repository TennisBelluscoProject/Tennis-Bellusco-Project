'use client';

import { useState } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { SearchBar, SectionSwitcher, Spinner, EmptyState } from '@/components/UI';
import type { Profile } from '@/lib/database.types';
import { getActivityDot } from '@/lib/utils';
import { StudentRow } from '../components/StudentRow';
import { GroupRow } from '../components/GroupRow';

/**
 * Allievi e Gruppi stanno nella stessa scheda, separati da un selettore.
 *
 * Non sono due voci della BottomNav perche' condividono tutto — ricerca,
 * scheda di dettaglio, pulsante "Aggiungi" — e perche' una sesta icona in
 * fondo allo schermo, su un telefono, diventa illeggibile.
 */
type Section = 'allievi' | 'gruppi';

interface Props {
  loading: boolean;
  students: Profile[];
  studentActivity: Record<string, Date | null>;
  studentStats: Record<string, { matches: number; wins: number; goals: number }>;
  groups: Profile[];
  /** Partecipanti per gruppo (id gruppo → conteggio). */
  groupMembers: Record<string, number>;
  /** Obiettivi non conclusi per gruppo. */
  groupGoals: Record<string, number>;
  search: string;
  onSearchChange: (s: string) => void;
  onSelect: (student: Profile) => void;
  onAdd: () => void;
  onAddGroup: () => void;
}

export function AllieviTab({
  loading,
  students,
  studentActivity,
  studentStats,
  groups,
  groupMembers,
  groupGoals,
  search,
  onSearchChange,
  onSelect,
  onAdd,
  onAddGroup,
}: Props) {
  const [section, setSection] = useState<Section>('allievi');
  const isGroups = section === 'gruppi';

  const query = search.toLowerCase();
  const filteredStudents = students.filter((s) =>
    `${s.full_name} ${s.email ?? ''}`.toLowerCase().includes(query)
  );
  const filteredGroups = groups.filter((g) => g.full_name.toLowerCase().includes(query));

  const total = isGroups ? groups.length : students.length;
  const subtitle = isGroups
    ? `${total} ${total === 1 ? 'gruppo' : 'gruppi'}`
    : `${total} ${total === 1 ? 'attivo' : 'attivi'}`;

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="px-4 pt-5 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className="text-2xl font-bold tracking-[-0.02em] text-[var(--foreground)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {isGroups ? 'Gruppi' : 'Allievi'}
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={isGroups ? onAddGroup : onAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-[13px] font-semibold shadow-sm active:scale-[0.97] transition-all"
            style={{
              background: isGroups ? 'var(--club-red)' : 'var(--club-blue)',
            }}
          >
            {isGroups ? <Users size={16} strokeWidth={2.2} /> : <UserPlus size={16} strokeWidth={2.2} />}
            Aggiungi
          </button>
        </div>

        <SectionSwitcher
          className="mb-3"
          tabs={[
            { id: 'allievi', label: 'Allievi', count: students.length, color: 'var(--club-blue)' },
            { id: 'gruppi', label: 'Gruppi', count: groups.length, color: 'var(--club-red)' },
          ]}
          active={section}
          onChange={(s) => {
            setSection(s as Section);
            // La ricerca e' condivisa fra le due liste: azzerarla evita un
            // falso "nessun risultato" al cambio di sezione.
            onSearchChange('');
          }}
        />

        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder={isGroups ? 'Cerca gruppo...' : 'Cerca allievo...'}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : isGroups ? (
          filteredGroups.length === 0 ? (
            <EmptyState
              icon={<Users size={40} strokeWidth={1.5} />}
              title="Nessun gruppo"
              message={
                search
                  ? 'Nessun risultato per la ricerca.'
                  : 'Crea un gruppo per le tue ore di lezione: potrai assegnargli obiettivi e percorsi come a un allievo.'
              }
            />
          ) : (
            <div className="flex flex-col gap-2.5 stagger-children">
              {filteredGroups.map((g) => (
                <GroupRow
                  key={g.id}
                  group={g}
                  members={groupMembers[g.id] ?? 0}
                  openGoals={groupGoals[g.id] ?? 0}
                  onClick={() => onSelect(g)}
                />
              ))}
            </div>
          )
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            icon={<Users size={40} strokeWidth={1.5} />}
            title="Nessun allievo"
            message={
              search
                ? 'Nessun risultato per la ricerca.'
                : 'Nessun allievo approvato. Le richieste di registrazione le trovi nella tab Richieste.'
            }
          />
        ) : (
          <div className="flex flex-col gap-2.5 stagger-children">
            {filteredStudents.map((s) => {
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
