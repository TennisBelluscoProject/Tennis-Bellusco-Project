'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button, Tabs, StatCard, Spinner, EmptyState } from '@/components/UI';
import type { Goal, MatchResultRow, GoalStatus } from '@/lib/database.types';
import { getDisplayRanking } from '@/lib/constants';
import { KanbanBoard } from '@/components/KanbanBoard';
import { GoalForm } from '@/components/GoalForm';
import { MatchCard } from '@/components/MatchCard';
import { MatchForm } from '@/components/MatchForm';

export function StudentDashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('obiettivi');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [matches, setMatches] = useState<MatchResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [matchFormOpen, setMatchFormOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<MatchResultRow | null>(null);

  // Ranking edit
  const [editingRanking, setEditingRanking] = useState(false);
  const [rankingValue, setRankingValue] = useState('');

  // Level edit
  const [editingLevel, setEditingLevel] = useState(false);
  const [levelValue, setLevelValue] = useState('');

  // Fetch data on mount and when user changes
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const [{ data: g }, { data: m }] = await Promise.all([
        supabase.from('goals').select('*').eq('student_id', user.id).order('sort_order'),
        supabase.from('match_results').select('*').eq('student_id', user.id).order('match_date', { ascending: false }),
      ]);
      if (!cancelled) {
        setGoals((g as Goal[]) || []);
        setMatches((m as MatchResultRow[]) || []);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Refetch helper for event handlers (not called from effects)
  const refetchData = async () => {
    if (!user) return;
    const [{ data: g }, { data: m }] = await Promise.all([
      supabase.from('goals').select('*').eq('student_id', user.id).order('sort_order'),
      supabase.from('match_results').select('*').eq('student_id', user.id).order('match_date', { ascending: false }),
    ]);
    setGoals((g as Goal[]) || []);
    setMatches((m as MatchResultRow[]) || []);
  };

  // Stats
  const wins = matches.filter((m) => m.result === 'win').length;
  const losses = matches.length - wins;
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;

  // Display values
  const { displayLevel, displayRanking } = profile
    ? getDisplayRanking(profile)
    : { displayLevel: 'Principiante', displayRanking: 'Non classificato' };

  // ─── Goal CRUD ─────────────────────────────────────
  const handleSaveGoal = async (data: Partial<Goal>) => {
    if (editingGoal) {
      await supabase.from('goals').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingGoal.id);
    } else {
      await supabase.from('goals').insert({ ...data, student_id: user!.id, created_by: user!.id });
    }
    await refetchData();
    setEditingGoal(null);
  };

  const handleDeleteGoal = async (id: string) => {
    await supabase.from('goals').delete().eq('id', id);
    await refetchData();
  };

  const handleGoalStatusChange = async (id: string, status: GoalStatus) => {
    const updates: Partial<Goal> = { status, updated_at: new Date().toISOString() };
    if (status === 'completed') { updates.progress = 100; updates.completed_at = new Date().toISOString(); }
    if (status === 'planned') { updates.progress = 0; updates.completed_at = null; }
    await supabase.from('goals').update(updates).eq('id', id);
    await refetchData();
  };

  const handleGoalProgressChange = async (id: string, progress: number) => {
    await supabase.from('goals').update({ progress, updated_at: new Date().toISOString() }).eq('id', id);
    setGoals((prev) => prev.map((g) => g.id === id ? { ...g, progress } : g));
  };

  // ─── Match CRUD ────────────────────────────────────
  const handleSaveMatch = async (data: Partial<MatchResultRow>) => {
    if (editingMatch) {
      await supabase.from('match_results').update(data).eq('id', editingMatch.id);
    } else {
      await supabase.from('match_results').insert({ ...data, student_id: user!.id });
    }
    await refetchData();
    setEditingMatch(null);
  };

  const handleDeleteMatch = async (id: string) => {
    await supabase.from('match_results').delete().eq('id', id);
    await refetchData();
  };

  // ─── Ranking ───────────────────────────────────────
  const handleSaveRanking = async () => {
    if (!user) return;
    await supabase.from('profiles').update({ ranking: rankingValue.trim() || 'Non classificato' }).eq('id', user.id);
    await refreshProfile();
    setEditingRanking(false);
  };

  // ─── Level ─────────────────────────────────────────
  const handleSaveLevel = async () => {
    if (!user) return;
    await supabase.from('profiles').update({ level: levelValue.trim() || 'Principiante' }).eq('id', user.id);
    await refreshProfile();
    setEditingLevel(false);
  };

  // FAB handler
  const handleFabClick = () => {
    if (activeTab === 'obiettivi') {
      setEditingGoal(null);
      setGoalFormOpen(true);
    } else {
      setEditingMatch(null);
      setMatchFormOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-6">
        {/* Subtitle */}
        <p className="text-sm text-gray-500 mb-5">Il tuo percorso tennistico</p>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatCard label="Win Rate" value={`${winRate}%`} icon="📊" color="var(--club-blue)" />
          <StatCard label="Vittorie" value={wins} icon="✅" color="var(--success)" />
          <StatCard label="Sconfitte" value={losses} icon="❌" color="var(--club-red)" />

          {/* Classifica FIT */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Classifica FIT</span>
              <button
                onClick={() => { setRankingValue(profile?.ranking || ''); setEditingRanking(true); }}
                className="text-[10px] hover:underline"
              >
                Modifica
              </button>
            </div>
            {editingRanking ? (
              <div className="flex gap-2 items-center">
                <input
                  value={rankingValue}
                  onChange={(e) => setRankingValue(e.target.value)}
                  className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1"
                  placeholder="4.3"
                />
                <button onClick={handleSaveRanking} className="text-xs text-green-600 font-medium">✓</button>
                <button onClick={() => setEditingRanking(false)} className="text-xs text-gray-400">✗</button>
              </div>
            ) : (
              <p className="text-2xl font-bold">{displayRanking}</p>
            )}
          </div>

          {/* Livello */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Livello</span>
              <button
                onClick={() => { setLevelValue(profile?.level || ''); setEditingLevel(true); }}
                className="text-[10px] hover:underline"
              >
                Modifica
              </button>
            </div>
            {editingLevel ? (
              <div className="flex gap-2 items-center">
                <select
                  value={levelValue}
                  onChange={(e) => setLevelValue(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1"
                >
                  <option value="Principiante">Principiante</option>
                  <option value="Intermedio">Intermedio</option>
                  <option value="Avanzato">Avanzato</option>
                </select>
                <button onClick={handleSaveLevel} className="text-xs text-green-600 font-medium">✓</button>
                <button onClick={() => setEditingLevel(false)} className="text-xs text-gray-400">✗</button>
              </div>
            ) : (
              <p className="text-2xl font-bold">{displayLevel}</p>
            )}
          </div>
        </div>

        {/* Tabs — no icons */}
        <Tabs
          tabs={[
            { id: 'obiettivi', label: 'I Miei Obiettivi' },
            { id: 'match', label: 'Risultati Agonistici' },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />

        <div className="mt-5">
          {activeTab === 'obiettivi' && (
            <>
              {/* Desktop: inline button | Mobile: FAB handles it */}
              <div className="hidden sm:flex justify-end mb-4">
                <Button variant="primary" onClick={() => { setEditingGoal(null); setGoalFormOpen(true); }}>
                  + Nuovo obiettivo
                </Button>
              </div>
              {goals.length === 0 ? (
                <EmptyState
                  icon="🎯"
                  title="Nessun obiettivo"
                  message="Crea il tuo primo obiettivo per iniziare il tuo percorso!"
                  action={<Button variant="primary" onClick={() => { setEditingGoal(null); setGoalFormOpen(true); }}>Crea obiettivo</Button>}
                />
              ) : (
                <KanbanBoard
                  goals={goals}
                  isCoach={false}
                  onEdit={(g) => { setEditingGoal(g); setGoalFormOpen(true); }}
                  onDelete={handleDeleteGoal}
                  onStatusChange={handleGoalStatusChange}
                  onProgressChange={handleGoalProgressChange}
                />
              )}
              <GoalForm
                open={goalFormOpen}
                onClose={() => { setGoalFormOpen(false); setEditingGoal(null); }}
                onSave={handleSaveGoal}
                goal={editingGoal}
                isCoach={false}
              />
            </>
          )}

          {activeTab === 'match' && (
            <>
              {/* Desktop: inline button | Mobile: FAB handles it */}
              <div className="hidden sm:flex justify-end mb-4">
                <Button variant="primary" onClick={() => { setEditingMatch(null); setMatchFormOpen(true); }}>
                  + Aggiungi Match
                </Button>
              </div>
              {matches.length === 0 ? (
                <EmptyState
                  icon="🏆"
                  title="Nessun match"
                  message="Registra il tuo primo match agonistico!"
                  action={<Button variant="primary" onClick={() => { setEditingMatch(null); setMatchFormOpen(true); }}>Aggiungi match</Button>}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {matches.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      onEdit={(m) => { setEditingMatch(m); setMatchFormOpen(true); }}
                      onDelete={handleDeleteMatch}
                    />
                  ))}
                </div>
              )}
              <MatchForm
                open={matchFormOpen}
                onClose={() => { setMatchFormOpen(false); setEditingMatch(null); }}
                onSave={handleSaveMatch}
                match={editingMatch}
              />
            </>
          )}
        </div>
      </main>

      {/* ─── Mobile FAB (floating action button) ─── */}
      <button
        onClick={handleFabClick}
        className="sm:hidden fixed bottom-6 right-5 z-40 w-14 h-14 rounded-full bg-[var(--club-red)] text-white shadow-lg shadow-[var(--club-red)]/30 flex items-center justify-center active:scale-90 transition-transform"
        aria-label={activeTab === 'obiettivi' ? 'Nuovo obiettivo' : 'Aggiungi match'}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
