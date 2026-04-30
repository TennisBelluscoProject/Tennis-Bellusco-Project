'use client';

import { useState, useRef, useEffect } from 'react';
import type { Goal, GoalStatus } from '@/lib/database.types';
import { CATEGORY_CONFIG, STATUS_CONFIG, STATUS_COLUMNS } from '@/lib/constants';
import { useIsMobile } from '@/lib/hooks';
import { Badge, ProgressBar, ConfirmDialog, Select } from './UI';

// ─── GoalCard ───────────────────────────────────────

interface GoalCardProps {
  goal: Goal;
  isCoach: boolean;
  isMobile: boolean;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: GoalStatus) => void;
  onProgressChange?: (id: string, progress: number) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
}

function GoalCard({ goal, isCoach, isMobile, onEdit, onDelete, onStatusChange, onProgressChange, onDragStart }: GoalCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cat = CATEGORY_CONFIG[goal.category];
  const nowRef = useRef(Date.now());
  const daysLeft = goal.deadline ? Math.ceil((new Date(goal.deadline).getTime() - nowRef.current) / (1000 * 60 * 60 * 24)) : null;
  const isCompleted = goal.status === 'completed';

  const currentIndex = STATUS_COLUMNS.indexOf(goal.status);
  const nextStatus = currentIndex < STATUS_COLUMNS.length - 1 ? STATUS_COLUMNS[currentIndex + 1] : null;
  const prevStatus = currentIndex > 0 ? STATUS_COLUMNS[currentIndex - 1] : null;

  // ─── Completed card: compact style ──────────────
  if (isCompleted) {
    const completedDate = goal.completed_at
      ? new Date(goal.completed_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
      : null;

    return (
      <>
        <div className="bg-gray-50/80 rounded-xl border border-gray-100 px-4 py-3 animate-fade-in shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-500 line-through decoration-gray-300 truncate">{goal.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-gray-400">{cat.icon} {cat.label}</span>
                {completedDate && (
                  <span className="text-[10px] text-gray-400">· {completedDate}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              {isMobile && prevStatus && (
                <button
                  onClick={() => onStatusChange(goal.id, prevStatus)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-all duration-200 active:scale-95"
                  title="Riapri"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                </button>
              )}
              <button onClick={() => onEdit(goal)} className="p-2 hover:bg-gray-200 rounded-lg transition-all duration-200" title="Modifica">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              </button>
              <button onClick={() => setConfirmDelete(true)} className="p-2 hover:bg-red-50 rounded-lg transition-all duration-200" title="Elimina">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
              </button>
            </div>
          </div>

          {!isMobile && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <select
                value={goal.status}
                onChange={(e) => onStatusChange(goal.id, e.target.value as GoalStatus)}
                className="text-[11px] bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--club-blue)]"
              >
                {STATUS_COLUMNS.map((s) => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].labelIt}</option>
                ))}
              </select>
            </div>
          )}
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

  // ─── Normal card (planned / in_progress) ────────
  return (
    <>
      <div
        draggable={!isMobile}
        onDragStart={(e) => !isMobile && onDragStart?.(e, goal.id)}
        className={`goal-card bg-white rounded-xl border border-gray-100 p-4 transition-all duration-200 animate-fade-in shrink-0 ${
          isMobile ? '' : 'hover:shadow-md hover:border-gray-200 cursor-grab active:cursor-grabbing'
        }`}
        style={{ '--cat-color': cat.color } as React.CSSProperties}
      >
        {/* Category badge + deadline */}
        <div className="flex items-center justify-between mb-3 pl-2">
          <Badge color={cat.color} bg={cat.bg}>
            <span>{cat.icon}</span> {cat.label}
          </Badge>
          {goal.deadline && (
            <span className={`text-[11px] font-semibold ${
              daysLeft !== null && daysLeft < 0
                ? 'text-red-600'
                : daysLeft !== null && daysLeft <= 7
                  ? 'text-orange-500'
                  : 'text-gray-400'
            }`}>
              {daysLeft !== null && daysLeft < 0 ? `Scaduto ${Math.abs(daysLeft)}g fa` : daysLeft !== null ? `${daysLeft}g rimasti` : ''}
            </span>
          )}
        </div>

        {/* Title */}
        <h4 className="text-sm font-bold text-gray-900 mb-1 line-clamp-2 pl-2 tracking-[-0.01em]">{goal.title}</h4>
        {goal.description && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-2 pl-2 leading-relaxed">{goal.description}</p>
        )}

        {/* Progress bar (only in_progress) */}
        {goal.status === 'in_progress' && (
          <div className="mb-3 pl-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-gray-500">Progresso</span>
              <span className="text-[11px] font-bold" style={{ color: cat.color }}>{goal.progress}%</span>
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
                className="w-full mt-2 h-1 accent-[var(--club-blue)] cursor-pointer"
              />
            )}
          </div>
        )}

        {/* Coach notes */}
        {goal.coach_notes && (
          <div className="bg-[var(--club-blue-light)] rounded-xl p-3 mb-3 ml-2 border border-[var(--club-blue)]/8">
            <div className="flex items-center gap-1.5 mb-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--club-blue)" strokeWidth="2.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <p className="text-[11px] font-bold text-[var(--club-blue)]">Note del maestro</p>
            </div>
            <p className="text-xs text-gray-700 line-clamp-3 leading-relaxed">{goal.coach_notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2.5 border-t border-gray-50 pl-2">
          {isMobile ? (
            <div className="flex items-center gap-2">
              {prevStatus && (
                <button
                  onClick={() => onStatusChange(goal.id, prevStatus)}
                  className="text-xs bg-gray-100 text-gray-600 rounded-lg px-3 py-2 font-semibold active:scale-95 transition-transform"
                >
                  ◀ {STATUS_CONFIG[prevStatus].labelIt}
                </button>
              )}
              {nextStatus && (
                <button
                  onClick={() => onStatusChange(goal.id, nextStatus)}
                  className="text-xs rounded-lg px-3 py-2 font-semibold text-white active:scale-95 transition-transform"
                  style={{
                    backgroundColor: nextStatus === 'completed' ? 'var(--success)' : 'var(--club-blue)',
                  }}
                >
                  {nextStatus === 'completed' ? '✓ Completa' : '▶ Inizia'}
                </button>
              )}
            </div>
          ) : (
            <select
              value={goal.status}
              onChange={(e) => onStatusChange(goal.id, e.target.value as GoalStatus)}
              className="text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--club-blue)]"
            >
              {STATUS_COLUMNS.map((s) => (
                <option key={s} value={s}>{STATUS_CONFIG[s].labelIt}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-0.5">
            <button onClick={() => onEdit(goal)} className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200" title="Modifica">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            </button>
            <button onClick={() => setConfirmDelete(true)} className="p-2 hover:bg-red-50 rounded-lg transition-all duration-200" title="Elimina">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
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

// ─── Kanban Column (desktop) ────────────────────────

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
  const statusColors: Record<GoalStatus, string> = {
    planned: 'var(--club-blue)',
    in_progress: 'var(--warning)',
    completed: 'var(--success)',
  };
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={`flex-1 min-w-[280px] rounded-2xl p-3 flex flex-col transition-all duration-200 h-[calc(100vh-320px)] min-h-[420px] max-h-[720px] ${
        dragOver ? 'bg-[var(--club-blue-light)] ring-2 ring-inset ring-[var(--club-blue)] ring-dashed' : 'bg-gray-50/60'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { setDragOver(false); onDrop(e, status); }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1.5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColors[status] }} />
          <h3 className="text-[13px] font-bold text-gray-700 tracking-[-0.01em]">{config.labelIt}</h3>
        </div>
        <span
          className="text-[11px] font-bold rounded-full px-2.5 py-0.5 min-w-[22px] text-center"
          style={{ backgroundColor: `${statusColors[status]}15`, color: statusColors[status] }}
        >
          {goals.length}
        </span>
      </div>

      {/* Cards (scrollable) */}
      <div className="kanban-col-scroll flex flex-col gap-2.5 stagger-children flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            isCoach={isCoach}
            isMobile={false}
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

// ─── Mobile Tab View ────────────────────────────────

interface MobileTabViewProps {
  goals: Goal[];
  isCoach: boolean;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: GoalStatus) => void;
  onProgressChange: (id: string, progress: number) => void;
  filterNode: React.ReactNode;
}

function MobileTabView({ goals, isCoach, onEdit, onDelete, onStatusChange, onProgressChange, filterNode }: MobileTabViewProps) {
  const [activeStatus, setActiveStatus] = useState<GoalStatus>('in_progress');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const statusColors: Record<GoalStatus, string> = {
    planned: 'var(--club-blue)',
    in_progress: 'var(--warning)',
    completed: 'var(--success)',
  };

  const filteredGoals = goals.filter((g) => g.status === activeStatus);
  const currentIndex = STATUS_COLUMNS.indexOf(activeStatus);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isSwipe = Math.abs(distance) > minSwipeDistance;

    if (isSwipe) {
      if (distance > 0 && currentIndex < STATUS_COLUMNS.length - 1) {
        setActiveStatus(STATUS_COLUMNS[currentIndex + 1]);
      } else if (distance < 0 && currentIndex > 0) {
        setActiveStatus(STATUS_COLUMNS[currentIndex - 1]);
      }
    }
  };

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeStatus]);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-20 bg-[var(--background)] pt-1 pb-3 min-h-[120px]">
        {/* Filter */}
        <div className="mb-4">
          {filterNode}
        </div>

        {/* Tab bar */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1 mb-4">
          {STATUS_COLUMNS.map((status) => {
            const count = goals.filter((g) => g.status === status).length;
            const isActive = activeStatus === status;
            return (
              <button
                key={status}
                onClick={() => setActiveStatus(status)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-white shadow-sm'
                    : 'text-gray-500 active:bg-gray-200'
                }`}
              >
                <span
                  className={isActive ? 'font-bold' : ''}
                  style={isActive ? { color: statusColors[status] } : undefined}
                >
                  {STATUS_CONFIG[status].labelIt}
                </span>
                {count > 0 && (
                  <span
                    className="text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none"
                    style={
                      isActive
                        ? { backgroundColor: statusColors[status], color: 'white' }
                        : { backgroundColor: '#E5E7EB', color: '#6B7280' }
                    }
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Swipe indicator dots */}
        <div className="flex justify-center gap-1.5">
          {STATUS_COLUMNS.map((status, i) => (
            <div
              key={status}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === currentIndex ? 16 : 6,
                backgroundColor: i === currentIndex ? statusColors[activeStatus] : '#D1D5DB',
              }}
            />
          ))}
        </div>
        
        {/* Bottom fade effect for scrolling cards */}
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-b from-[var(--background)] to-transparent pointer-events-none translate-y-full" />
      </div>

      {/* Card list (swipeable, natural height) */}
      <div
        ref={contentRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="scrollbar-hidden pb-4 pt-2"
      >
        {filteredGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="empty-illustration bg-gray-50 mb-2">
              <span className="text-2xl">
                {activeStatus === 'planned' ? '📋' : activeStatus === 'in_progress' ? '⚡' : '✅'}
              </span>
            </div>
            <p className="text-sm text-gray-500 font-medium">
              {activeStatus === 'planned' && 'Nessun obiettivo in programma'}
              {activeStatus === 'in_progress' && 'Nessun obiettivo in corso'}
              {activeStatus === 'completed' && 'Nessun obiettivo concluso'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-2">
            {filteredGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                isCoach={isCoach}
                isMobile={true}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onProgressChange={onProgressChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KanbanBoard (main export) ──────────────────────

interface KanbanBoardProps {
  goals: Goal[];
  isCoach: boolean;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: GoalStatus) => void;
  onProgressChange: (id: string, progress: number) => void;
}

export function KanbanBoard({ goals, isCoach, onEdit, onDelete, onStatusChange, onProgressChange }: KanbanBoardProps) {
  const isMobile = useIsMobile();
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
      {isMobile ? (
        <MobileTabView
          goals={filtered}
          isCoach={isCoach}
          onEdit={onEdit}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          onProgressChange={onProgressChange}
          filterNode={
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categoryOptions}
            />
          }
        />
      ) : (
        <>
          {/* Filter (Desktop) */}
          <div className="mb-4">
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categoryOptions}
              className="max-w-[220px]"
            />
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4">
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
        </>
      )}
    </div>
  );
}
