'use client';

import { CircleCheck } from 'lucide-react';
import { Spinner, EmptyState } from '@/components/UI';
import type { Profile } from '@/lib/database.types';
import { PendingCard } from '../components/PendingCard';

interface Props {
  loading: boolean;
  pending: Profile[];
  actingOn: string | null;
  onApprove: (p: Profile) => void;
  onReject: (p: Profile) => void;
}

export function RichiesteTab({ loading, pending, actingOn, onApprove, onReject }: Props) {
  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="px-4 pt-5 pb-4 shrink-0">
        <h2
          className="text-2xl font-bold text-gray-900 tracking-[-0.02em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Approvazioni
        </h2>
        <p className="text-[12px] text-gray-500 mt-0.5 mb-5">
          {pending.length} in attesa
        </p>

        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          In attesa di approvazione
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : pending.length === 0 ? (
          <EmptyState icon={<CircleCheck size={32} strokeWidth={1.5} />} title="Tutto in ordine" message="Nessuna registrazione in attesa." />
        ) : (
          <div className="flex flex-col gap-3 stagger-children">
            {pending.map((p) => (
              <PendingCard
                key={p.id}
                profile={p}
                busy={actingOn === p.id}
                onApprove={() => onApprove(p)}
                onReject={() => onReject(p)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
