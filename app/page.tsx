'use client';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/UI';
import { LoginPage } from './login/LoginPage';
import { CoachDashboard } from './coach/CoachDashboard';
import { StudentDashboard } from './student/StudentDashboard';

function AppRouter() {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user || !profile) return <LoginPage />;
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
