'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isCoach: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    console.log('[Auth] Fetching profile for', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[Auth] Profile query error:', error.message, error.code);
      return null;
    }

    console.log('[Auth] Profile loaded:', data?.email, data?.role);
    return data as Profile;
  } catch (err) {
    console.error('[Auth] Profile exception:', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // IMPORTANT: onAuthStateChange callback must NOT be async and must NOT
    // call other Supabase functions directly. Doing so causes a deadlock
    // due to the internal lock mechanism in supabase-js.
    // See: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
    // Fix: use setTimeout(0) to defer Supabase calls outside the callback.

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('[Auth] Event:', event, newSession?.user?.email ?? 'no user');

      if (!mountedRef.current) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setSession(null);
        setLoading(false);
        return;
      }

      // For all events with a session (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED)
      if (newSession?.user) {
        // Set user/session immediately (no Supabase calls needed)
        setSession(newSession);
        setUser(newSession.user);

        // Defer profile fetch to avoid deadlock
        const userId = newSession.user.id;
        setTimeout(async () => {
          const p = await fetchProfile(userId);
          if (mountedRef.current) {
            setProfile(p);
            setLoading(false);
          }
        }, 0);
        return;
      }

      // No session (first load without login)
      setUser(null);
      setProfile(null);
      setSession(null);
      setLoading(false);
    });

    // Safety timeout — if no auth event fires at all (very rare)
    const timeout = setTimeout(() => {
      if (mountedRef.current && loading) {
        console.warn('[Auth] Timeout — no auth event in 12s, forcing login');
        setLoading(false);
      }
    }, 12000);

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      return { error: error.message };
    }
    // onAuthStateChange(SIGNED_IN) will fire and handle profile loading
    return { error: null };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ) => {
    const { data: authData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpErr) return { error: signUpErr.message };

    if (authData.user) {
      const names = fullName.trim().split(' ');
      const firstName = names[0] || '';
      const lastName = names.slice(1).join(' ') || '';

      const { error: profileErr } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email,
        full_name: fullName.trim(),
        first_name: firstName,
        last_name: lastName,
        role: 'allievo',
        level: 'Principiante',
        ranking: 'Non classificato',
        active: true,
        approval_status: 'pending',
      });

      if (profileErr) console.error('Profile creation error:', profileErr);
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    // onAuthStateChange(SIGNED_OUT) handles cleanup
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user.id);
      if (mountedRef.current) setProfile(p);
    }
  };

  const isCoach = profile?.role === 'maestro';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        isCoach,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
