'use client';

import { useState } from 'react';
import type { MatchResultRow } from '@/lib/database.types';
import { SURFACE_LABELS, RESULT_LABELS } from '@/lib/constants';
import { Badge, ConfirmDialog } from './UI';

interface MatchCardProps {
  match: MatchResultRow;
  showStudentName?: boolean;
  isCoach?: boolean;
  onEdit: (match: MatchResultRow) => void;
  onDelete: (id: string) => void;
  onEditCoachNotes?: (match: MatchResultRow) => void;
}

export function MatchCard({ match, showStudentName, isCoach, onEdit, onDelete, onEditCoachNotes }: MatchCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isWin = match.result === 'win';
  const date = new Date(match.match_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all animate-fade-in overflow-hidden ${
        isWin ? 'border-green-100' : 'border-red-100'
      }`}>
        {/* Result strip at top */}
        <div className={`h-1 ${isWin ? 'bg-green-500' : 'bg-red-400'}`} />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              {showStudentName && match.profiles && (
                <p className="text-[11px] font-medium text-[var(--club-blue)] mb-1">{match.profiles.full_name}</p>
              )}
              <h4 className="text-sm font-semibold text-gray-900 truncate">{match.tournament_name || 'Match'}</h4>
              <p className="text-xs text-gray-500 mt-0.5">{date}</p>
            </div>
            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 ml-3 ${
              isWin ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}>
              {match.result === 'win' ? 'Vittoria' : match.result === 'loss' ? 'Sconfitta' : RESULT_LABELS[match.result]}
            </div>
          </div>

          {/* Score highlight */}
          {match.score && (
            <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3 text-center">
              <span className="text-lg font-bold text-gray-800 tracking-wide">{match.score}</span>
              {match.opponent_name && (
                <p className="text-[11px] text-gray-500 mt-0.5">vs {match.opponent_name}{match.opponent_ranking ? ` (${match.opponent_ranking})` : ''}</p>
              )}
            </div>
          )}

          {/* Details grid */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 text-xs">
            {!match.score && match.opponent_name && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">vs</span>
                <span className="font-medium text-gray-700">{match.opponent_name}</span>
              </div>
            )}
            {match.surface && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">Sup.</span>
                <span className="font-medium text-gray-700">{SURFACE_LABELS[match.surface]}{match.indoor ? ' (Indoor)' : ''}</span>
              </div>
            )}
            {match.round && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">Turno</span>
                <span className="font-medium text-gray-700">{match.round}</span>
              </div>
            )}
            {match.category && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">Cat.</span>
                <span className="font-medium text-gray-700">{match.category}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {match.notes && (
            <div className="bg-gray-50 rounded-lg p-2.5 mb-2">
              <p className="text-xs text-gray-600">{match.notes}</p>
            </div>
          )}

          {/* Coach notes */}
          {match.coach_notes && (
            <div className="bg-[var(--club-blue-light)] rounded-lg p-2.5 mb-2 border border-[var(--club-blue)]/10">
              <p className="text-[11px] font-medium text-[var(--club-blue)] mb-0.5">📝 Note del maestro</p>
              <p className="text-xs text-gray-700">{match.coach_notes}</p>
            </div>
          )}

          {/* Actions — bigger touch targets */}
          <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-50">
            {isCoach && onEditCoachNotes && (
              <button onClick={() => onEditCoachNotes(match)} className="p-2.5 hover:bg-blue-50 rounded-lg transition-colors active:scale-95" title="Note maestro">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--club-blue)" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
              </button>
            )}
            <button onClick={() => onEdit(match)} className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors active:scale-95" title="Modifica">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            </button>
            <button onClick={() => setConfirmDelete(true)} className="p-2.5 hover:bg-red-50 rounded-lg transition-colors active:scale-95" title="Elimina">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
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
