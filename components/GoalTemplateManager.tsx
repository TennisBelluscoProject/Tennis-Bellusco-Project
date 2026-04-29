'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { GoalCategory, GoalTemplate, PlayerLevel } from '@/lib/database.types';
import { CATEGORY_CONFIG, LEVELS } from '@/lib/constants';
import { useIsMobile } from '@/lib/hooks';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  SearchBar,
  Select,
  Spinner,
  Textarea,
} from './UI';

interface GoalTemplateManagerProps {
  coachId: string;
}

type CategoryFilter = '' | GoalCategory;
type LevelFilter = '' | PlayerLevel;

export function GoalTemplateManager({ coachId }: GoalTemplateManagerProps) {
  const isMobile = useIsMobile();
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('');
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GoalTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GoalTemplate | null>(null);

  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('goal_templates')
        .select('*')
        .order('level')
        .order('category')
        .order('sort_order')
        .order('title');
      if (!cancelled) {
        setTemplates((data as GoalTemplate[]) || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (levelFilter && t.level !== levelFilter) return false;
      if (q) {
        const hay = `${t.title} ${t.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [templates, categoryFilter, levelFilter, search]);

  const handleSave = async (data: Partial<GoalTemplate>) => {
    if (editing) {
      await supabase.from('goal_templates').update(data).eq('id', editing.id);
    } else {
      await supabase.from('goal_templates').insert({ ...data, created_by: coachId });
    }
    setReloadTick((t) => t + 1);
  };

  const handleDelete = async (tpl: GoalTemplate) => {
    await supabase.from('goal_templates').delete().eq('id', tpl.id);
    setReloadTick((t) => t + 1);
  };

  const categoryPills: { value: CategoryFilter; label: string; icon?: string }[] = [
    { value: '', label: 'Tutte' },
    ...(Object.entries(CATEGORY_CONFIG) as [GoalCategory, (typeof CATEGORY_CONFIG)[GoalCategory]][]).map(
      ([k, v]) => ({ value: k as CategoryFilter, label: v.label, icon: v.icon })
    ),
  ];

  const levelPills: { value: LevelFilter; label: string }[] = [
    { value: '', label: 'Tutti' },
    ...LEVELS.map((lv) => ({ value: lv as LevelFilter, label: lv })),
  ];

  const filtersBlock = (
    <div className="flex flex-col gap-2">
      <div
        className={`flex gap-1.5 ${
          isMobile ? 'overflow-x-auto flex-nowrap scrollbar-hidden -mx-1 px-1' : 'flex-wrap'
        }`}
      >
        {categoryPills.map((p) => {
          const isActive = categoryFilter === p.value;
          return (
            <button
              key={p.value || 'all-cat'}
              onClick={() => setCategoryFilter(p.value)}
              className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--club-blue)] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.icon && <span>{p.icon}</span>}
              {p.label}
            </button>
          );
        })}
      </div>

      <div
        className={`flex gap-1.5 ${
          isMobile ? 'overflow-x-auto flex-nowrap scrollbar-hidden -mx-1 px-1' : 'flex-wrap'
        }`}
      >
        {levelPills.map((p) => {
          const isActive = levelFilter === p.value;
          return (
            <button
              key={p.value || 'all-lvl'}
              onClick={() => setLevelFilter(p.value)}
              className={`shrink-0 inline-flex items-center px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--club-red)] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Cerca per titolo o descrizione..."
      />
    </div>
  );

  const headerBlock = (
    <>
      <div>
        <h2
          className="text-2xl font-bold text-gray-900 tracking-[-0.02em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Catalogo Obiettivi
        </h2>
        <p className="text-[12px] text-gray-500 mt-0.5">
          {templates.length} {templates.length === 1 ? 'template' : 'template'} disponibili
        </p>
      </div>
      {filtersBlock}
    </>
  );

  const listBlock = loading ? (
    <div className="flex justify-center py-12">
      <Spinner />
    </div>
  ) : filtered.length === 0 ? (
    <EmptyState
      icon="📋"
      title={templates.length === 0 ? 'Nessun template' : 'Nessun risultato'}
      message={
        templates.length === 0
          ? 'Crea il primo obiettivo per il catalogo.'
          : 'Prova a cambiare filtri o ricerca.'
      }
      action={
        templates.length === 0 ? (
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Crea template
          </Button>
        ) : undefined
      }
    />
  ) : (
    <div
      className={
        isMobile
          ? 'flex flex-col gap-2.5'
          : 'grid grid-cols-2 lg:grid-cols-3 gap-3 stagger-children'
      }
    >
      {filtered.map((t) => (
        <CoachTemplateCard
          key={t.id}
          template={t}
          compact={isMobile}
          onEdit={() => {
            setEditing(t);
            setFormOpen(true);
          }}
          onDelete={() => setConfirmDelete(t)}
        />
      ))}
    </div>
  );

  return (
    <div
      className={
        isMobile
          ? 'flex flex-col flex-1 min-h-0 overflow-hidden'
          : 'flex flex-col gap-4 pb-24'
      }
    >
      {isMobile ? (
        <>
          <div className="px-4 pt-4 pb-3 flex flex-col gap-3 shrink-0 border-b border-gray-100">
            {headerBlock}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-32">
            {listBlock}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3">{headerBlock}</div>
          {listBlock}
        </>
      )}

      {/* FAB (mobile and desktop) — su mobile alzato per non finire sotto la BottomNav */}
      <button
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        className="fab"
        aria-label="Nuovo template"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <TemplateForm
        open={formOpen}
        template={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Elimina template"
        message={
          confirmDelete
            ? `Sei sicuro di voler eliminare "${confirmDelete.title}" dal catalogo? Gli obiettivi già copiati dagli allievi non verranno toccati.`
            : ''
        }
        confirmLabel="Elimina"
        onConfirm={() => {
          if (confirmDelete) handleDelete(confirmDelete);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

// ─── Coach template card ──────────────────────────────

interface CoachTemplateCardProps {
  template: GoalTemplate;
  compact: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function CoachTemplateCard({ template, compact, onEdit, onDelete }: CoachTemplateCardProps) {
  const cat = CATEGORY_CONFIG[template.category];

  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 ${
        compact ? 'p-3' : 'p-4 hover:shadow-md hover:border-gray-200 transition-all duration-200'
      } animate-fade-in flex flex-col gap-2`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Badge color={cat.color} bg={cat.bg}>
          <span>{cat.icon}</span> {cat.label}
        </Badge>
        <Badge>{template.level}</Badge>
      </div>
      <p className="text-sm font-bold text-gray-900 tracking-[-0.01em]">{template.title}</p>
      {template.description && (
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{template.description}</p>
      )}

      <div className="flex items-center justify-end gap-0.5 pt-2 mt-1 border-t border-gray-50">
        <button
          onClick={onEdit}
          className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 min-w-[44px] flex items-center justify-center"
          title="Modifica"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B7280"
            strokeWidth="2"
          >
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="p-2 hover:bg-red-50 rounded-lg transition-all duration-200 min-w-[44px] flex items-center justify-center"
          title="Elimina"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#EF4444"
            strokeWidth="2"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Form (create / edit template) ────────────────────

interface TemplateFormProps {
  open: boolean;
  template: GoalTemplate | null;
  onClose: () => void;
  onSave: (data: Partial<GoalTemplate>) => Promise<void>;
}

function TemplateForm({ open, template, onClose, onSave }: TemplateFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GoalCategory>('tecnica');
  const [level, setLevel] = useState<PlayerLevel>('Principiante');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (template) {
      setTitle(template.title);
      setDescription(template.description || '');
      setCategory(template.category);
      setLevel(template.level);
    } else {
      setTitle('');
      setDescription('');
      setCategory('tecnica');
      setLevel('Principiante');
    }
    setError('');
  }, [template, open]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Inserisci un titolo');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        category,
        level,
      });
      onClose();
    } catch {
      setError('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions = Object.entries(CATEGORY_CONFIG).map(([k, v]) => ({
    value: k,
    label: `${v.icon} ${v.label}`,
  }));

  const levelOptions = LEVELS.map((lv) => ({ value: lv, label: lv }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template ? 'Modifica template' : 'Nuovo template'}
    >
      {/* Altezza fissa: il dialog non cambia dimensione tra create/edit né in base al testo */}
      <div className="flex flex-col h-[460px]">
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
          <Input
            label="Titolo"
            value={title}
            onChange={setTitle}
            required
            placeholder="Es. Migliorare il rovescio in topspin"
          />
          <Textarea
            label="Descrizione"
            value={description}
            onChange={setDescription}
            placeholder="Dettagli sull'obiettivo (visibili anche all'allievo)..."
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Categoria"
              value={category}
              onChange={(v) => setCategory(v as GoalCategory)}
              options={categoryOptions}
              required
            />
            <Select
              label="Livello"
              value={level}
              onChange={(v) => setLevel(v as PlayerLevel)}
              options={levelOptions}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-3 justify-end pt-3 mt-2 border-t border-gray-100">
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="primary" loading={saving} onClick={handleSubmit}>
            {template ? 'Salva modifiche' : 'Crea template'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
