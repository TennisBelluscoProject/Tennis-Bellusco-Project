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
  signUp: (input: SignUpInput) => Promise<{ error: string | null }>;
  verifySignupOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  resendSignupOtp: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export interface SignUpInput {
  firstName: string;
  lastName: string;
  age: number;
  ranking: string;
  level?: string;
  email: string;
  password: string;
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      // Friendlier message for unconfirmed email
      if (/email not confirmed/i.test(error.message)) {
        return {
          error:
            'Devi prima verificare la tua email. Controlla la posta e inserisci il codice ricevuto.',
        };
      }
      return { error: error.message };
    }

    // Check approval status before letting them in
    if (data.user) {
      const p = await fetchProfile(data.user.id);
      if (p && p.role === 'allievo' && p.approval_status !== 'approved') {
        await supabase.auth.signOut({ scope: 'local' });
        setLoading(false);
        if (p.approval_status === 'rejected') {
          return {
            error:
              'La tua registrazione è stata rifiutata dal maestro. Per chiarimenti contatta il club.',
          };
        }
        return {
          error:
            'È necessario essere approvati dal maestro per poter accedere. Attendi la conferma.',
        };
      }
    }

    // onAuthStateChange(SIGNED_IN) will fire and handle profile loading
    return { error: null };
  };

  const signUp = async (input: SignUpInput) => {
    const { firstName, lastName, age, ranking, level, email, password } = input;
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const fullName = `${cleanFirst} ${cleanLast}`.trim();

    // The DB trigger handle_new_user reads these metadata fields and creates
    // the profile row in a single atomic step. Don't INSERT explicitly here:
    // it would race with the trigger and fail with duplicate key.
    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          first_name: cleanFirst,
          last_name: cleanLast,
          age: Math.floor(age),
          ranking: ranking.trim() || 'Non classificato',
          level: level || 'Principiante',
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpErr) return { error: signUpErr.message };
    return { error: null };
  };

  const verifySignupOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const resendSignupOtp = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) return { error: error.message };
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
        verifySignupOtp,
        resendSignupOtp,
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
