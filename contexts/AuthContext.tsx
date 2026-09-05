'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  /** ISO date string yyyy-MM-dd */
  birthDate: string;
  ranking: string;
  level?: string;
  email: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Le tracce dell'accesso servono a chi sviluppa, non a chi usa l'app: in
 * produzione stampavano id utente, email e ruolo nella console del browser —
 * dati personali lasciati in chiaro a chiunque apra gli strumenti, e rumore
 * su ogni cambio di scheda. Restano attive solo fuori dalla build finale.
 */
const debug = process.env.NODE_ENV !== 'production';

async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    if (debug) console.log('[Auth] Fetching profile for', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[Auth] Profile query error:', error.message, error.code);
      return null;
    }

    if (debug) console.log('[Auth] Profile loaded:', data?.email, data?.role);
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

  // Lo stesso valore di `loading`, ma leggibile da dentro una chiusura creata
  // una volta sola. Vedi la rete di sicurezza a 12 secondi piu' sotto.
  const loadingRef = useRef(true);
  const stopLoading = useCallback(() => {
    loadingRef.current = false;
    setLoading(false);
  }, []);
  const startLoading = useCallback(() => {
    loadingRef.current = true;
    setLoading(true);
  }, []);

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
      if (debug) console.log('[Auth] Event:', event, newSession?.user?.email ?? 'no user');

      if (!mountedRef.current) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setSession(null);
        stopLoading();
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
            stopLoading();
          }
        }, 0);
        return;
      }

      // No session (first load without login)
      setUser(null);
      setProfile(null);
      setSession(null);
      stopLoading();
    });

    // Rete di sicurezza: se non arriva NESSUN evento di autenticazione.
    //
    // La condizione leggeva `loading` di stato. Questo effetto pero' gira una
    // volta sola (dipendenze vuote), quindi quella chiusura resta legata al
    // primo valore — `true` — per sempre: il ramo era percio' vero SEMPRE,
    // anche quando l'accesso si era risolto in mezzo secondo. Risultato: a
    // ogni sessione, dodici secondi dopo l'avvio, compariva in console un
    // avviso di guasto che guasto non era, e si chiamava `setLoading(false)`
    // su uno stato gia' falso. Il ref, a differenza della variabile di stato,
    // e' sempre il valore corrente.
    const timeout = setTimeout(() => {
      if (mountedRef.current && loadingRef.current) {
        console.warn('[Auth] Timeout: nessun evento di autenticazione in 12s');
        stopLoading();
      }
    }, 12000);

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [stopLoading]);

  const signIn = useCallback(async (email: string, password: string) => {
    startLoading();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      stopLoading();
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
        stopLoading();
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
  }, [startLoading, stopLoading]);

  const signUp = useCallback(async (input: SignUpInput) => {
    const { firstName, lastName, birthDate, ranking, level, email, password } = input;
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
          birth_date: birthDate,
          ranking: ranking.trim() || 'Non classificato',
          level: level || 'Principiante',
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpErr) return { error: signUpErr.message };
    return { error: null };
  }, []);

  const verifySignupOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const resendSignupOtp = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' });
    // onAuthStateChange(SIGNED_OUT) handles cleanup
  }, []);

  // Legata all'id e non all'oggetto utente: `TOKEN_REFRESHED` consegna un
  // `user` nuovo di zecca con lo stesso id, e senza questo dettaglio la
  // funzione cambierebbe identita' a ogni rinnovo del token, disfacendo la
  // memoizzazione qui sotto.
  const userId = user?.id ?? null;
  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const p = await fetchProfile(userId);
    if (mountedRef.current) setProfile(p);
  }, [userId]);

  const isCoach = profile?.role === 'maestro';

  /**
   * L'oggetto del contesto va MEMOIZZATO.
   *
   * Prima era una graffa scritta in linea nella JSX: un oggetto nuovo a ogni
   * render del provider, quindi ogni consumatore di `useAuth()` — le due
   * dashboard, PlayerView, l'intestazione, il profilo — si ridisegnava anche
   * quando nessuno dei valori era cambiato. E i render del provider non sono
   * rari: supabase-js emette `TOKEN_REFRESHED` al rinnovo del token e al
   * ritorno sulla scheda, e ognuno di quegli eventi chiama tre setState. Il
   * risultato era che tornando sull'app dopo averla lasciata in secondo piano
   * si ridisegnava tutto l'albero per nulla — lo scatto che si notava
   * rientrando in una schermata.
   */
  const value = useMemo(
    () => ({
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
    }),
    [
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
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
