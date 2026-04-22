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

async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data as Profile;
  } catch (err) {
    console.error('fetchProfile exception:', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  // Init: get current session then listen to auth state changes
  useEffect(() => {
    // 1. Immediately get the current session (handles page refresh / existing cookies)
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user) {
        setUser(currentSession.user);
        const p = await getProfile(currentSession.user.id);
        setProfile(p);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
      initialized.current = true;
    }).catch(() => {
      setLoading(false);
      initialized.current = true;
    });

    // 2. Listen for future auth changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      console.log('Auth event:', event);

      // Skip INITIAL_SESSION if we already handled it above
      if (event === 'INITIAL_SESSION' && initialized.current) return;

      setSession(s);

      if (s?.user) {
        setUser(s.user);
        const p = await getProfile(s.user.id);
        setProfile(p);
      } else {
        setUser(null);
        setProfile(null);
      }

      setLoading(false);
      initialized.current = true;
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error?.message ?? null };
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
        // Don't fail the signup — the user exists in auth, they just need a profile
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
