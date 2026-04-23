'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button, Input } from '@/components/UI';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto-detect invite token and auth errors from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    const authError = params.get('error');
    if (token) {
      queueMicrotask(() => {
        setInviteToken(token);
        setMode('register');
      });
    }
    if (authError === 'auth_callback_error') {
      queueMicrotask(() => {
        setError('Errore di autenticazione. Il link potrebbe essere scaduto, riprova.');
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const { error: err } = await signIn(email, password);
        if (err) {
          setError(err);
          setSubmitting(false);
        }
        // If no error, signIn sets AuthContext.loading=true,
        // which makes AppRouter show LoadingScreen.
        // We don't set submitting=false because the component will unmount.
      } else if (mode === 'register') {
        if (!inviteToken.trim()) {
          setError('Inserisci il codice invito');
          setSubmitting(false);
          return;
        }
        if (!fullName.trim()) {
          setError('Inserisci nome e cognome');
          setSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setError('La password deve avere almeno 6 caratteri');
          setSubmitting(false);
          return;
        }

        const { error: err } = await signUp(email, password, fullName, inviteToken);
        if (err) {
          setError(err);
        } else {
          setSuccess(
            "Account creato! Controlla la tua email per verificare l'account, poi effettua il login."
          );
        }
        setSubmitting(false);
      }
    } catch (err) {
      console.error('Submit error:', err);
      setError('Si è verificato un errore. Riprova.');
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Inserisci la tua email');
      return;
    }

    setSubmitting(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      }
    );

    if (resetError) {
      setError(resetError.message);
    } else {
      setSuccess(
        'Email di reset inviata! Controlla la tua casella di posta e clicca sul link per reimpostare la password.'
      );
    }

    setSubmitting(false);
  };

  const getTitle = () => {
    switch (mode) {
      case 'login':
        return 'Accedi al tuo profilo';
      case 'register':
        return 'Crea il tuo account';
      case 'forgot':
        return 'Recupera la password';
    }
  };

  const getButtonLabel = () => {
    switch (mode) {
      case 'login':
        return 'Accedi';
      case 'register':
        return 'Crea account';
      case 'forgot':
        return 'Invia link di reset';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[var(--club-red)] flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">🎾</span>
          </div>
          <h1
            className="text-2xl font-bold text-[var(--club-blue)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Tennis Club Bellusco
          </h1>
          <p className="text-sm text-gray-500 mt-1">{getTitle()}</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <form
            onSubmit={mode === 'forgot' ? handleForgotPassword : handleSubmit}
            className="flex flex-col gap-4"
          >
            {mode === 'register' && (
              <>
                <Input
                  label="Codice invito"
                  value={inviteToken}
                  onChange={setInviteToken}
                  placeholder="Inserisci il codice ricevuto dal maestro"
                  required
                />
                <Input
                  label="Nome e Cognome"
                  value={fullName}
                  onChange={setFullName}
                  placeholder="Mario Rossi"
                  required
                />
              </>
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="la-tua@email.com"
              required
            />

            {mode !== 'forgot' && (
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder={
                  mode === 'register' ? 'Minimo 6 caratteri' : '••••••••'
                }
                required
              />
            )}

            {error && (
              <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-3 border border-green-100">
                {success}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              className="w-full mt-2"
            >
              {getButtonLabel()}
            </Button>
          </form>

          {/* Footer links */}
          <div className="mt-5 pt-5 border-t border-gray-100 text-center flex flex-col gap-2">
            {mode === 'login' && (
              <>
                <p className="text-sm text-gray-500">
                  Hai ricevuto un invito?{' '}
                  <button
                    onClick={() => {
                      setMode('register');
                      setError('');
                      setSuccess('');
                    }}
                    className="font-medium text-[var(--club-red)] hover:underline"
                  >
                    Registrati
                  </button>
                </p>
                <p className="text-sm text-gray-500">
                  <button
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setSuccess('');
                    }}
                    className="font-medium text-[var(--club-blue)] hover:underline"
                  >
                    Password dimenticata?
                  </button>
                </p>
              </>
            )}

            {mode === 'register' && (
              <p className="text-sm text-gray-500">
                Hai già un account?{' '}
                <button
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccess('');
                  }}
                  className="font-medium text-[var(--club-red)] hover:underline"
                >
                  Accedi
                </button>
              </p>
            )}

            {mode === 'forgot' && (
              <p className="text-sm text-gray-500">
                Ricordi la password?{' '}
                <button
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccess('');
                  }}
                  className="font-medium text-[var(--club-red)] hover:underline"
                >
                  Torna al login
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Footer stripe */}
        <div className="flex justify-center mt-6 gap-2">
          <div className="w-12 h-1 rounded-full bg-[var(--club-red)]" />
          <div className="w-12 h-1 rounded-full bg-white border border-gray-200" />
          <div className="w-12 h-1 rounded-full bg-[var(--club-blue)]" />
        </div>
      </div>
    </div>
  );
}
