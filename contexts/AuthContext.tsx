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
    fullName: string,
    inviteToken: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('Profile fetch error:', error.message);
      return null;
    }
    return data as Profile;
  } catch (err) {
    console.error('Profile fetch exception:', err);
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

    // Single source of truth: onAuthStateChange handles EVERYTHING.
    // We do NOT call getSession() manually — Supabase fires INITIAL_SESSION
    // as the very first event, which gives us the session if one exists.

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth event:', event, newSession?.user?.email ?? 'no user');

      if (!mountedRef.current) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setSession(null);
        setLoading(false);
        return;
      }

      // For all events with a session (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, etc.)
      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);

        // Fetch profile
        const p = await fetchProfile(newSession.user.id);

        if (!mountedRef.current) return;

        setProfile(p);
        setLoading(false);
        return;
      }

      // No session (first load with no login, or session expired)
      setUser(null);
      setProfile(null);
      setSession(null);
      setLoading(false);
    });

    // Safety timeout — if onAuthStateChange never fires (very rare edge case)
    const timeout = setTimeout(() => {
      if (mountedRef.current && loading) {
        console.warn('Auth timeout — no auth event received in 10s');
        setLoading(false);
      }
    }, 10000);

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
    // Success: onAuthStateChange(SIGNED_IN) will fire and load the profile
    return { error: null };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    inviteToken: string
  ) => {
    // 1. Validate invite token
    const { data: invite, error: invErr } = await supabase
      .from('invite_links')
      .select('*')
      .eq('token', inviteToken)
      .is('used_at', null)
      .single();

    if (invErr || !invite) {
      return { error: 'Link di invito non valido o già utilizzato.' };
    }

    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    if (now > expiresAt) {
      return { error: 'Il link di invito è scaduto.' };
    }

    // 2. Sign up
    const { data: authData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpErr) {
      return { error: signUpErr.message };
    }

    if (authData.user) {
      const names = fullName.trim().split(' ');
      const firstName = names[0] || '';
      const lastName = names.slice(1).join(' ') || '';

      // 3. Create profile
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
      });

      if (profileErr) {
        console.error('Profile creation error:', profileErr);
      }

      // 4. Mark invite as used
      await supabase
        .from('invite_links')
        .update({ used_at: new Date().toISOString() })
        .eq('id', invite.id);
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    // onAuthStateChange(SIGNED_OUT) handles state cleanup
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
