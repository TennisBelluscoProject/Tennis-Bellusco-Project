'use client';

import { useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Button, LoadingScreen } from '@/components/UI';
import { LoginPage } from './login/LoginPage';
import { CoachDashboard } from './coach/CoachDashboard';
import { StudentDashboard } from './student/StudentDashboard';
import { supabase } from '@/lib/supabase';

function ProfileNotFound({ userId }: { userId: string }) {
  const { refreshProfile } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleRetry = async () => {
    await refreshProfile();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Profilo non trovato</h2>
        <p className="text-sm text-gray-600 mb-6">
          Il tuo account è stato creato ma il profilo non è stato caricato.
          Prova a ricaricare, oppure contatta il maestro.
        </p>
        <p className="text-xs text-gray-400 mb-4">ID: {userId}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleRetry}
            className="px-6 py-2.5 bg-[var(--club-blue)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Riprova
          </button>
          <button
            onClick={handleLogout}
            className="px-6 py-2.5 bg-[var(--club-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Torna al login
          </button>
        </div>
      </div>
    </div>
  );
}

function PendingApprovalScreen({ rejected }: { rejected: boolean }) {
  const { profile, signOut, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  return (
    <div className="login-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px] relative z-10">
        <div className="card p-8 text-center animate-slide-up">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${
            rejected ? 'bg-red-50' : 'bg-amber-50'
          }`}>
            {rejected ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2 tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
            {rejected ? 'Registrazione rifiutata' : 'In attesa di approvazione'}
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            {rejected
              ? 'La tua richiesta di registrazione è stata rifiutata dal maestro. Per chiarimenti contatta direttamente il club.'
              : 'La tua email è stata verificata. Ora il tuo account è in attesa di approvazione da parte del maestro: riceverai accesso non appena verrai approvato.'}
          </p>

          {profile?.email && (
            <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Email registrata</p>
              <p className="text-sm font-medium text-gray-800 break-all">{profile.email}</p>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {!rejected && (
              <Button variant="primary" size="lg" className="w-full" loading={refreshing} onClick={handleRefresh}>
                Verifica stato
              </Button>
            )}
            <Button variant="secondary" size="lg" className="w-full" onClick={signOut}>
              Esci
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppRouter() {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginPage />;
  if (!profile) return <ProfileNotFound userId={user.id} />;

  // Coaches always have access
  if (profile.role === 'maestro') return <CoachDashboard />;

  // Allievi: must be approved
  if (profile.approval_status === 'pending') return <PendingApprovalScreen rejected={false} />;
  if (profile.approval_status === 'rejected') return <PendingApprovalScreen rejected={true} />;

  return <StudentDashboard />;
}

export default function Home() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
