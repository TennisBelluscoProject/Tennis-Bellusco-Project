'use client';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/UI';
import { LoginPage } from './login/LoginPage';
import { CoachDashboard } from './coach/CoachDashboard';
import { StudentDashboard } from './student/StudentDashboard';

function AppRouter() {
  const { user, profile, loading } = useAuth();

  // Show loading screen while auth is initializing or during sign-in transition
  if (loading) return <LoadingScreen />;

  // No user at all — show login
  if (!user) return <LoginPage />;

  // User exists but no profile found — show an error state instead of login loop
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Profilo non trovato</h2>
          <p className="text-sm text-gray-600 mb-6">
            Il tuo account è stato creato ma il profilo non è stato configurato.
            Contatta il maestro per risolvere il problema.
          </p>
          <p className="text-xs text-gray-400 mb-4">ID: {user.id}</p>
          <button
            onClick={async () => {
              const { supabase } = await import('@/lib/supabase');
              await supabase.auth.signOut({ scope: 'local' });
              window.location.reload();
            }}
            className="px-6 py-2.5 bg-[var(--club-red)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Torna al login
          </button>
        </div>
      </div>
    );
  }

  // Everything is ready — route to the correct dashboard
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
