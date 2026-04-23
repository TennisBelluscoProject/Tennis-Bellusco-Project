'use client';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/UI';
import { LoginPage } from './login/LoginPage';
import { CoachDashboard } from './coach/CoachDashboard';
import { StudentDashboard } from './student/StudentDashboard';
import { supabase } from '@/lib/supabase';

function ProfileNotFound({ userId }: { userId: string }) {
  const { refreshProfile } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange will handle state cleanup and show LoginPage
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

function AppRouter() {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginPage />;
  if (!profile) return <ProfileNotFound userId={user.id} />;
  if (profile.role === 'maestro') return <CoachDashboard />;
  return <StudentDashboard />;
}

export default function Home() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
