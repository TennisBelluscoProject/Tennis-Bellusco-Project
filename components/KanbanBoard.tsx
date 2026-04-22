'use client';

import { useState, useRef } from 'react';
import type { Goal, GoalStatus, GoalCategory } from '@/lib/database.types';
import { CATEGORY_CONFIG, STATUS_CONFIG, STATUS_COLUMNS } from '@/lib/constants';
import { Badge, ProgressBar, Button, ConfirmDialog, Select } from './UI';

interface GoalCardProps {
  goal: Goal;
  isCoach: boolean;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: GoalStatus) => void;
  onProgressChange?: (id: string, progress: number) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
}

function GoalCard({ goal, isCoach, onEdit, onDelete, onStatusChange, onProgressChange, onDragStart }: GoalCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cat = CATEGORY_CONFIG[goal.category];
  const nowRef = useRef(Date.now());
  const daysLeft = goal.deadline ? Math.ceil((new Date(goal.deadline).getTime() - nowRef.current) / (1000 * 60 * 60 * 24)) : null;

  return (
    <>
      <div
        draggable
        onDragStart={(e) => onDragStart?.(e, goal.id)}
        className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing animate-fade-in"
      >
        {/* Category badge */}
        <div className="flex items-center justify-between mb-3">
          <Badge color={cat.color} bg={cat.bg}>
            <span>{cat.icon}</span> {cat.label}
          </Badge>
          {goal.deadline && (
            <span className={`text-[11px] font-medium ${daysLeft !== null && daysLeft < 0 ? 'text-red-600' : daysLeft !== null && daysLeft <= 7 ? 'text-orange-500' : 'text-gray-400'}`}>
              {daysLeft !== null && daysLeft < 0 ? `Scaduto ${Math.abs(daysLeft)}g fa` : daysLeft !== null ? `${daysLeft}g rimasti` : ''}
            </span>
          )}
        </div>

        {/* Title */}
        <h4 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">{goal.title}</h4>
        {goal.description && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-2">{goal.description}</p>
        )}

        {/* Progress bar (only in_progress) */}
        {goal.status === 'in_progress' && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-gray-500">Progresso</span>
              <span className="text-[11px] font-semibold" style={{ color: cat.color }}>{goal.progress}%</span>
            </div>
            <ProgressBar value={goal.progress} color={cat.color} />
            {(isCoach || goal.status === 'in_progress') && (
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={goal.progress}
                onChange={(e) => onProgressChange?.(goal.id, parseInt(e.target.value))}
                className="w-full mt-1.5 h-1 accent-[var(--club-blue)] cursor-pointer"
              />
            )}
          </div>
        )}

        {/* Coach notes */}
        {goal.coach_notes && (
          <div className="bg-[var(--club-blue-light)] rounded-lg p-2.5 mb-3 border border-[var(--club-blue)]/10">
            <p className="text-[11px] font-medium text-[var(--club-blue)] mb-0.5">📝 Note del maestro</p>
            <p className="text-xs text-gray-700 line-clamp-3">{goal.coach_notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <select
            value={goal.status}
            onChange={(e) => onStatusChange(goal.id, e.target.value as GoalStatus)}
            className="text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--club-blue)]"
          >
            {STATUS_COLUMNS.map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].labelIt}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button onClick={() => onEdit(goal)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Modifica">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            </button>
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Elimina">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Elimina obiettivo"
        message={`Sei sicuro di voler eliminare "${goal.title}"? Questa azione non può essere annullata.`}
        confirmLabel="Elimina"
        onConfirm={() => { onDelete(goal.id); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

// ─── Kanban Column ──────────────────────────────────

interface KanbanColumnProps {
  status: GoalStatus;
  goals: Goal[];
  isCoach: boolean;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: GoalStatus) => void;
  onProgressChange: (id: string, progress: number) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, status: GoalStatus) => void;
}

function KanbanColumn({ status, goals, isCoach, onEdit, onDelete, onStatusChange, onProgressChange, onDragStart, onDrop }: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  const config = STATUS_CONFIG[status];
  const statusColors: Record<GoalStatus, string> = {
    planned: 'var(--club-blue)',
    in_progress: 'var(--warning)',
    completed: 'var(--success)',
  };

  return (
    <div
      className={`flex-1 min-w-[280px] rounded-2xl p-3 transition-all ${dragOver ? 'bg-[var(--club-blue-light)] ring-2 ring-[var(--club-blue)] ring-dashed' : 'bg-gray-50/80'}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { setDragOver(false); onDrop(e, status); }}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColors[status] }} />
          <h3 className="text-sm font-semibold text-gray-700">{config.labelIt}</h3>
        </div>
        <span className="text-xs font-medium text-gray-400 bg-white rounded-full px-2 py-0.5">{goals.length}</span>
      </div>
      <div className="flex flex-col gap-2.5 kanban-column">
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            isCoach={isCoach}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onProgressChange={onProgressChange}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </div>
  );
}

// ─── KanbanBoard ────────────────────────────────────

interface KanbanBoardProps {
  goals: Goal[];
  isCoach: boolean;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: GoalStatus) => void;
  onProgressChange: (id: string, progress: number) => void;
}

export function KanbanBoard({ goals, isCoach, onEdit, onDelete, onStatusChange, onProgressChange }: KanbanBoardProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const filtered = categoryFilter ? goals.filter((g) => g.category === categoryFilter) : goals;

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: GoalStatus) => {
    e.preventDefault();
    if (draggedId) {
      onStatusChange(draggedId, status);
      setDraggedId(null);
    }
  };

  const categoryOptions = [
    { value: '', label: 'Tutte le categorie' },
    ...Object.entries(CATEGORY_CONFIG).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` })),
  ];

  return (
    <div>
      {/* Filter */}
      <div className="mb-4">
        <Select
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={categoryOptions}
          className="max-w-[220px]"
        />
      </div>

      {/* Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {STATUS_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            goals={filtered.filter((g) => g.status === status)}
            isCoach={isCoach}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onProgressChange={onProgressChange}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
}
