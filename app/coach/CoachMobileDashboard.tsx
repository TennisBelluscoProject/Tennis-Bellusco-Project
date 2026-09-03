'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmDialog } from '@/components/UI';
import type { Profile, Goal, MatchResultRow } from '@/lib/database.types';
import { MobileHeader } from './components/MobileHeader';
import { BottomNav, type CoachTabId } from './components/BottomNav';
import { HomeTab } from './tabs/HomeTab';
import { AllieviTab } from './tabs/AllieviTab';
import { CatalogoTab } from './tabs/CatalogoTab';
import { RisultatiTab } from './tabs/RisultatiTab';
import { RichiesteTab } from './tabs/RichiesteTab';
import { CreateStudentForm } from './components/CreateStudentForm';
import { CreateGroupForm } from './components/CreateGroupForm';
import { groupRepo } from '@/lib/repositories';
import { PlayerView } from '../student/PlayerView';

const DISMISSED_KEY = 'tcb-dismissed-notifs-v1';

export function CoachMobileDashboard() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<CoachTabId>('home');

  const [students, setStudents] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<Profile[]>([]);
  const [groupMembers, setGroupMembers] = useState<Record<string, number>>({});
  const [groupGoals, setGroupGoals] = useState<Record<string, number>>({});
  const [pendingProfiles, setPendingProfiles] = useState<Profile[]>([]);
  const [studentActivity, setStudentActivity] = useState<Record<string, Date | null>>({});
  const [studentStats, setStudentStats] = useState<Record<string, { matches: number; wins: number; goals: number }>>({});
  const [allMatches, setAllMatches] = useState<MatchResultRow[]>([]);
  const [recentGoals, setRecentGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'win' | 'loss'>('all');
  const [notifFilter, setNotifFilter] = useState<'all' | 'goal' | 'match'>('all');

  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);
  const [confirmReject, setConfirmReject] = useState<Profile | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);

  const persistDismissed = (s: Set<string>) => {
    setDismissed(s);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s]));
    } catch {}
  };

  const [reloadTick, setReloadTick] = useState(0);
  const fetchAll = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // `is_group` esclude i gruppi di lezione, che dal 2026_gruppi.sql sono
      // anch'essi righe di `profiles` con role 'allievo' (ADR-5-1).
      const [studentsRes, pendingRes, matchesRes, goalsRes, groupsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'allievo').eq('is_group', false).eq('approval_status', 'approved').eq('active', true).order('full_name'),
        supabase.from('profiles').select('*').eq('role', 'allievo').eq('is_group', false).eq('approval_status', 'pending').order('created_at', { ascending: false }),
        supabase.from('match_results').select('*, profiles!match_results_student_id_fkey(full_name)').order('match_date', { ascending: false }).limit(150),
        supabase.from('goals').select('*, profiles!goals_student_id_fkey(full_name)').order('updated_at', { ascending: false }).limit(150),
        groupRepo.list(),
      ]);
      if (cancelled) return;

      const groupList = groupsRes.data ?? [];
      const groupIds = groupList.map((g) => g.id);

      // Conteggi dei gruppi: partono dopo, perche' servono gli id. Sono due
      // query leggere su poche decine di righe, non vale la pena complicare.
      const [membersRes, groupGoalsRes] = await Promise.all([
        groupRepo.countMembers(groupIds),
        groupIds.length > 0
          ? supabase.from('goals').select('student_id, status').in('student_id', groupIds)
          : Promise.resolve({ data: [] as { student_id: string; status: string }[] }),
      ]);
      if (cancelled) return;

      const gGoals: Record<string, number> = {};
      for (const id of groupIds) gGoals[id] = 0;
      for (const row of (groupGoalsRes.data ?? []) as { student_id: string; status: string }[]) {
        if (row.status !== 'completed') gGoals[row.student_id] = (gGoals[row.student_id] ?? 0) + 1;
      }

      const sList = (studentsRes.data as Profile[]) || [];
      const matches = (matchesRes.data as MatchResultRow[]) || [];
      const goals = (goalsRes.data as Goal[]) || [];

      const activity: Record<string, Date | null> = {};
      const stats: Record<string, { matches: number; wins: number; goals: number }> = {};
      for (const s of sList) {
        activity[s.id] = null;
        stats[s.id] = { matches: 0, wins: 0, goals: 0 };
      }
      for (const m of matches) {
        const sid = m.student_id;
        if (!stats[sid]) continue;
        stats[sid].matches += 1;
        if (m.result === 'win') stats[sid].wins += 1;
        const dt = new Date(m.created_at);
        if (!activity[sid] || dt > activity[sid]!) activity[sid] = dt;
      }
      for (const g of goals) {
        const sid = g.student_id;
        if (!stats[sid]) continue;
        if (g.status !== 'completed') stats[sid].goals += 1;
        const dt = new Date(g.updated_at);
        if (!activity[sid] || dt > activity[sid]!) activity[sid] = dt;
      }

      setStudents(sList);
      setGroups(groupList);
      setGroupMembers(membersRes.data ?? {});
      setGroupGoals(gGoals);
      setPendingProfiles((pendingRes.data as Profile[]) || []);
      setAllMatches(matches);
      setRecentGoals(goals);
      setStudentActivity(activity);
      setStudentStats(stats);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  // Stessa ragione della dashboard da scrivania: `selectedStudent` e' una
  // copia scattata al momento del clic e `fetchAll()` ricarica l'elenco ma
  // non lei. Senza questa risincronizzazione la scheda dell'allievo continua
  // a lavorare sul profilo vecchio, e un percorso Kids appena attivato o
  // disattivato sembra non essere cambiato finche' non si ricarica la pagina.
  useEffect(() => {
    if (!selectedStudent) return;
    const fresco =
      students.find((s) => s.id === selectedStudent.id) ??
      groups.find((g) => g.id === selectedStudent.id);
    if (fresco && fresco !== selectedStudent) setSelectedStudent(fresco);
  }, [students, groups, selectedStudent]);

  // Approve / Reject
  const handleApprove = async (p: Profile) => {
    setActingOn(p.id);
    await supabase
      .from('profiles')
      .update({
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user?.id ?? null,
      })
      .eq('id', p.id);
    fetchAll();
    setActingOn(null);
  };
  const handleReject = async (p: Profile) => {
    setActingOn(p.id);
    await supabase
      .from('profiles')
      .update({
        approval_status: 'rejected',
        approved_at: new Date().toISOString(),
        approved_by: user?.id ?? null,
      })
      .eq('id', p.id);
    fetchAll();
    setConfirmReject(null);
    setActingOn(null);
  };

  // Selected student detail (uses shared PlayerView)
  if (selectedStudent) {
    return (
      <div className="h-[100dvh] flex flex-col bg-[var(--background)]">
        <MobileHeader onLogout={signOut} />
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col page-gutter-x pt-5">
          <PlayerView
            player={selectedStudent}
            mode="coach"
            writerId={user?.id ?? ''}
            onBack={() => {
              setSelectedStudent(null);
              fetchAll();
            }}
            onDataChanged={fetchAll}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-[var(--background)]">
      <MobileHeader onLogout={signOut} />

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {tab === 'home' && (
          <HomeTab
            loading={loading}
            students={students}
            studentActivity={studentActivity}
            recentGoals={recentGoals}
            allMatches={allMatches}
            notifFilter={notifFilter}
            onNotifFilterChange={setNotifFilter}
            dismissed={dismissed}
            onDismissOne={(id) => persistDismissed(new Set([...dismissed, id]))}
            onDismissAll={() => {
              const ids: string[] = [];
              for (const g of recentGoals) if (g.status === 'completed' && g.completed_at) ids.push(`goal:${g.id}`);
              for (const m of allMatches) ids.push(`match:${m.id}`);
              persistDismissed(new Set([...dismissed, ...ids]));
            }}
          />
        )}

        {tab === 'allievi' && (
          <AllieviTab
            loading={loading}
            students={students}
            studentActivity={studentActivity}
            studentStats={studentStats}
            groups={groups}
            groupMembers={groupMembers}
            groupGoals={groupGoals}
            search={search}
            onSearchChange={setSearch}
            onSelect={setSelectedStudent}
            onAdd={() => setCreateOpen(true)}
            onAddGroup={() => setCreateGroupOpen(true)}
          />
        )}

        {tab === 'catalogo' && (
          <CatalogoTab coachId={user?.id ?? ''} onOpenStudent={setSelectedStudent} />
        )}

        {tab === 'risultati' && (
          <RisultatiTab
            loading={loading}
            allMatches={allMatches}
            resultFilter={resultFilter}
            onResultFilterChange={setResultFilter}
          />
        )}

        {tab === 'richieste' && (
          <RichiesteTab
            loading={loading}
            pending={pendingProfiles}
            actingOn={actingOn}
            onApprove={handleApprove}
            onReject={(p) => setConfirmReject(p)}
          />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} pendingCount={pendingProfiles.length} />

      <ConfirmDialog
        open={!!confirmReject}
        title="Rifiutare la registrazione?"
        message={
          confirmReject
            ? `Sei sicuro di voler rifiutare la registrazione di ${confirmReject.full_name}? L'utente non potrà accedere.`
            : ''
        }
        confirmLabel="Rifiuta"
        onConfirm={() => confirmReject && handleReject(confirmReject)}
        onCancel={() => setConfirmReject(null)}
      />

      <CreateStudentForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => fetchAll()}
      />

      <CreateGroupForm
        open={createGroupOpen}
        coachId={user?.id ?? null}
        onClose={() => setCreateGroupOpen(false)}
        onCreated={() => fetchAll()}
      />
    </div>
  );
}
