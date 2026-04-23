'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
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

async function getProfile(userId: string, retries = 3): Promise<Profile | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        console.error(`Profile fetch attempt ${i + 1} error:`, error);
        if (i < retries - 1) {
          await new Promise((r) => setTimeout(r, 500 * (i + 1)));
          continue;
        }
        return null;
      }
      return data as Profile;
    } catch (err) {
      console.error(`Profile fetch attempt ${i + 1} exception:`, err);
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);
  const profileLoadingRef = useRef(false);

  const loadUserAndProfile = useCallback(async (s: Session | null) => {
    if (!s?.user) {
      setUser(null);
      setProfile(null);
      setSession(null);
      setLoading(false);
      return;
    }

    // Prevent duplicate profile loads
    if (profileLoadingRef.current) return;
    profileLoadingRef.current = true;

    setSession(s);
    setUser(s.user);

    const p = await getProfile(s.user.id);
    setProfile(p);
    setLoading(false);

    profileLoadingRef.current = false;

    if (!p) {
      console.error('Profile not found for user:', s.user.id, '- user will see login screen');
    }
  }, []);

  useEffect(() => {
    const initSession = async () => {
      try {
        const {
          data: { session: currentSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !currentSession) {
          setUser(null);
          setProfile(null);
          setSession(null);
          setLoading(false);
          initialized.current = true;
          return;
        }

        // Validate the session is still valid server-side
        const {
          data: { user: validatedUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !validatedUser) {
          console.warn('Stale session detected, clearing...');
          await supabase.auth.signOut({ scope: 'local' });
          setUser(null);
          setProfile(null);
          setSession(null);
          setLoading(false);
          initialized.current = true;
          return;
        }

        // Session is valid — load profile
        await loadUserAndProfile(currentSession);
      } catch {
        console.error('Auth init failed');
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        setUser(null);
        setProfile(null);
        setSession(null);
        setLoading(false);
      } finally {
        initialized.current = true;
      }
    };

    // Timeout safety net
    const timeout = setTimeout(() => {
      if (!initialized.current) {
        console.warn('Auth init timeout — forcing login screen');
        supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        setUser(null);
        setProfile(null);
        setSession(null);
        setLoading(false);
        initialized.current = true;
      }
    }, 8000);

    initSession().finally(() => clearTimeout(timeout));

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      console.log('Auth event:', event);

      // Skip INITIAL_SESSION — we already handled it above
      if (event === 'INITIAL_SESSION') return;

      // For SIGNED_IN after a signInWithPassword, load user+profile
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await loadUserAndProfile(s);
        return;
      }

      // For SIGNED_OUT, clear state
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setSession(null);
        setLoading(false);
        return;
      }

      // Other events (PASSWORD_RECOVERY, USER_UPDATED, etc.)
      if (s?.user) {
        setSession(s);
        setUser(s.user);
        // Only reload profile if we don't have one or user changed
        if (!profile || profile.id !== s.user.id) {
          const p = await getProfile(s.user.id);
          setProfile(p);
        }
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    // Set loading to true so AppRouter shows LoadingScreen during transition
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      return { error: error.message };
    }
    // Don't set loading to false here — onAuthStateChange(SIGNED_IN) will
    // load the profile and then set loading=false
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

    // 2. Sign up with Supabase Auth
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
    setLoading(true);
    await supabase.auth.signOut({ scope: 'local' });
    // onAuthStateChange(SIGNED_OUT) will clear state
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await getProfile(user.id);
      setProfile(p);
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
