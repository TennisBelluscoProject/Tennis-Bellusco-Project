'use client';

import { useState } from 'react';
import type { MatchResultRow } from '@/lib/database.types';
import { SURFACE_LABELS, RESULT_LABELS } from '@/lib/constants';
import { ConfirmDialog } from './UI';

interface MatchCardProps {
  match: MatchResultRow;
  showStudentName?: boolean;
  isCoach?: boolean;
  onEdit: (match: MatchResultRow) => void;
  onDelete: (id: string) => void;
  onEditCoachNotes?: (match: MatchResultRow) => void;
}

const SURFACE_ICONS: Record<string, string> = {
  terra_rossa: '🟤',
  erba: '🟢',
  cemento: '⚪',
  sintetico: '🔵',
};

export function MatchCard({ match, showStudentName, isCoach, onEdit, onDelete, onEditCoachNotes }: MatchCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isWin = match.result === 'win';
  const date = new Date(match.match_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <div className={`card card-interactive flex flex-col overflow-hidden h-full animate-fade-in`}>
        {/* Result accent strip */}
        <div className={`h-1 shrink-0 ${isWin ? 'bg-green-500' : 'bg-red-400'}`} />

        <div className="flex flex-col flex-1 p-4">
          {/* Header row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              {showStudentName && match.profiles && (
                <p className="text-[11px] font-semibold text-[var(--club-blue)] mb-1 tracking-wide uppercase">
                  {match.profiles.full_name}
                </p>
              )}
              <h4 className="text-sm font-bold text-gray-900 truncate tracking-[-0.01em]">
                {match.tournament_name || 'Match'}
              </h4>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">{date}</p>
            </div>
            <div className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 ml-3 ${
              isWin ? 'result-badge-win' : 'result-badge-loss'
            }`}>
              {match.result === 'win' ? 'Vittoria' : match.result === 'loss' ? 'Sconfitta' : RESULT_LABELS[match.result]}
            </div>
          </div>

          {/* Score highlight */}
          {match.score && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-3 text-center border border-gray-100/60">
              <span className="text-xl font-bold text-gray-800 score-display">{match.score}</span>
              {match.opponent_name && (
                <p className="text-[11px] text-gray-500 mt-1 font-medium">
                  vs {match.opponent_name}
                  {match.opponent_ranking ? <span className="text-gray-400"> ({match.opponent_ranking})</span> : ''}
                </p>
              )}
            </div>
          )}

          {/* Details */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 text-xs">
            {!match.score && match.opponent_name && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 font-medium">vs</span>
                <span className="font-semibold text-gray-700">{match.opponent_name}</span>
              </div>
            )}
            {match.surface && (
              <div className="flex items-center gap-1.5">
                <span className="text-sm leading-none">{SURFACE_ICONS[match.surface] || '🎾'}</span>
                <span className="font-medium text-gray-600">
                  {SURFACE_LABELS[match.surface]}
                  {match.indoor ? ' (Indoor)' : ''}
                </span>
              </div>
            )}
            {match.round && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 font-medium">Turno</span>
                <span className="font-semibold text-gray-700">{match.round}</span>
              </div>
            )}
            {match.category && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 font-medium">Cat.</span>
                <span className="font-semibold text-gray-700">{match.category}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {match.notes && (
            <div className="bg-gray-50 rounded-xl p-3 mb-2 border border-gray-100/60">
              <p className="text-xs text-gray-600 leading-relaxed">{match.notes}</p>
            </div>
          )}

          {/* Coach notes */}
          {match.coach_notes && (
            <div className="bg-[var(--club-blue-light)] rounded-xl p-3 mb-2 border border-[var(--club-blue)]/8">
              <div className="flex items-center gap-1.5 mb-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--club-blue)" strokeWidth="2.5">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                <p className="text-[11px] font-bold text-[var(--club-blue)]">Note del maestro</p>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">{match.coach_notes}</p>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center justify-end gap-0.5 pt-2.5 mt-2.5 border-t border-gray-100">
            {isCoach && onEditCoachNotes && (
              <button
                onClick={() => onEditCoachNotes(match)}
                className="p-2.5 hover:bg-[var(--club-blue-light)] rounded-xl transition-all duration-200 active:scale-95"
                title="Note maestro"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--club-blue)" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </button>
            )}
            <button
              onClick={() => onEdit(match)}
              className="p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200 active:scale-95"
              title="Modifica"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-2.5 hover:bg-red-50 rounded-xl transition-all duration-200 active:scale-95"
              title="Elimina"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Elimina match"
        message="Sei sicuro di voler eliminare questo match? Questa azione non può essere annullata."
        confirmLabel="Elimina"
        onConfirm={() => { onDelete(match.id); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
