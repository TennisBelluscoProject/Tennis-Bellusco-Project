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
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            {showStudentName && match.profiles && (
              <p className="text-[11px] font-medium text-[var(--club-blue)] mb-1">{match.profiles.full_name}</p>
            )}
            <h4 className="text-sm font-semibold text-gray-900">{match.tournament_name || 'Match'}</h4>
            <p className="text-xs text-gray-500 mt-0.5">{date}</p>
          </div>
          <div className={`px-3 py-1.5 rounded-xl text-xs font-bold ${isWin ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {match.result === 'win' ? 'V' : match.result === 'loss' ? 'S' : RESULT_LABELS[match.result]}
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Avversario</span>
            <span className="text-xs font-medium text-gray-700">{match.opponent_name || '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Risultato</span>
            <span className="text-xs font-medium text-gray-700">{match.score || '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Superficie</span>
            <span className="text-xs font-medium text-gray-700">
              {match.surface ? SURFACE_LABELS[match.surface] : '—'}
              {match.indoor && ' (Indoor)'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Turno</span>
            <span className="text-xs font-medium text-gray-700">{match.round || '—'}</span>
          </div>
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

        {/* Actions */}
        <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-50">
          {isCoach && onEditCoachNotes && (
            <button onClick={() => onEditCoachNotes(match)} className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors" title="Note maestro">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--club-blue)" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            </button>
          )}
          <button onClick={() => onEdit(match)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Modifica">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          <button onClick={() => setConfirmDelete(true)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Elimina">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
          </button>
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
