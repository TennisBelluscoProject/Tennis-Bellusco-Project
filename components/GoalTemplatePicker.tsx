'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { GoalCategory, GoalTemplate, PlayerLevel } from '@/lib/database.types';
import { CATEGORY_CONFIG, LEVELS } from '@/lib/constants';
import { useIsMobile } from '@/lib/hooks';
import { Badge, SearchBar, Spinner, EmptyState } from './UI';

interface GoalTemplatePickerProps {
  defaultLevel?: PlayerLevel;
  onSelect: (template: GoalTemplate) => void;
  onBack: () => void;
  onCreateCustom: () => void;
}

type CategoryFilter = '' | GoalCategory;
type LevelFilter = '' | PlayerLevel;

export function GoalTemplatePicker({
  defaultLevel,
  onSelect,
  onBack,
  onCreateCustom,
}: GoalTemplatePickerProps) {
  const isMobile = useIsMobile();
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>(defaultLevel ?? '');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('goal_templates')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('title', { ascending: true });
      if (!cancelled) {
        setTemplates((data as GoalTemplate[]) || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const categoryPills: { value: CategoryFilter; label: string; icon?: string; color?: string }[] = [
    { value: '', label: 'Tutte' },
    ...(Object.entries(CATEGORY_CONFIG) as [GoalCategory, (typeof CATEGORY_CONFIG)[GoalCategory]][]).map(
      ([k, v]) => ({ value: k as CategoryFilter, label: v.label, icon: v.icon, color: v.color })
    ),
  ];

  const levelPills: { value: LevelFilter; label: string }[] = [
    { value: '', label: 'Tutti i livelli' },
    ...LEVELS.map((lv) => ({ value: lv as LevelFilter, label: lv })),
  ];

  return (
    // Altezza fissa: il dialog non cambia in base al numero di template
    <div className="flex flex-col h-[65dvh] min-h-[420px] max-h-[560px] gap-3">
      {/* Header (sticky) — back link, filtri, ricerca */}
      <div className="shrink-0 flex flex-col gap-3 pb-2 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-500 hover:text-[var(--club-blue)] transition-colors group -ml-1 px-1 py-1 rounded-lg"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="group-hover:-translate-x-0.5 transition-transform"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Indietro
          </button>
          <button
            onClick={onCreateCustom}
            className="text-[12px] font-semibold text-[var(--club-blue)] hover:underline px-1 py-1"
          >
            Crea il tuo →
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2">
        {/* Category pills (scroll su mobile, wrap su desktop) */}
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

        {/* Level pills */}
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

          <SearchBar value={search} onChange={setSearch} placeholder="Cerca nel catalogo..." />
        </div>
      </div>

      {/* Result list (scrolla solo questa, l'header rimane fisso) */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 pb-1">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="📋"
            title="Nessun obiettivo trovato"
            message={
              templates.length === 0
                ? 'Il catalogo è vuoto. Chiedi al maestro di aggiungere obiettivi oppure creane uno personalizzato.'
                : 'Prova a cambiare filtri o crea un obiettivo personalizzato.'
            }
          />
        ) : (
          <div className={isMobile ? 'flex flex-col gap-2' : 'grid grid-cols-2 gap-3'}>
            {filtered.map((t) => (
              <TemplateCard key={t.id} template={t} compact={isMobile} onClick={() => onSelect(t)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface TemplateCardProps {
  template: GoalTemplate;
  compact: boolean;
  onClick: () => void;
}

function TemplateCard({ template, compact, onClick }: TemplateCardProps) {
  const cat = CATEGORY_CONFIG[template.category];

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="text-left bg-white rounded-xl border border-gray-100 px-3 py-2.5 active:scale-[0.98] active:bg-gray-50 transition-all duration-150 flex flex-col gap-1.5"
      >
        <div className="flex items-center gap-2">
          <Badge color={cat.color} bg={cat.bg}>
            <span>{cat.icon}</span> {cat.label}
          </Badge>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            {template.level}
          </span>
        </div>
        <p className="text-sm font-bold text-gray-900 line-clamp-2 tracking-[-0.01em]">
          {template.title}
        </p>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="text-left bg-gray-50/80 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-3.5 cursor-pointer flex flex-col gap-1.5"
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
    </button>
  );
}
