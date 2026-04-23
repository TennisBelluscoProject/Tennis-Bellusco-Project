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
        return 'Bentornato';
      case 'register':
        return 'Inizia il tuo percorso';
      case 'forgot':
        return 'Recupera la password';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'login':
        return 'Accedi al tuo profilo tennistico';
      case 'register':
        return 'Crea il tuo account per iniziare';
      case 'forgot':
        return 'Ti invieremo un link per reimpostare la password';
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
    <div className="login-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px] relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[var(--club-red)] flex items-center justify-center mx-auto mb-5 shadow-lg relative overflow-hidden">
            <span className="text-3xl relative z-10">🎾</span>
            <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent" />
          </div>
          <h1
            className="text-[28px] font-bold text-[var(--club-blue)] tracking-[-0.02em] mb-1"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Tennis Club Bellusco
          </h1>
          {/* Decorative stripe */}
          <div className="flex justify-center mt-4 mb-5 gap-1">
            <div className="w-8 h-[3px] rounded-full bg-[var(--club-red)]" />
            <div className="w-8 h-[3px] rounded-full bg-gray-200" />
            <div className="w-8 h-[3px] rounded-full bg-[var(--club-blue)]" />
          </div>
          <p
            className="text-xl font-semibold text-gray-900 tracking-[-0.01em]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {getTitle()}
          </p>
          <p className="text-sm text-gray-500 mt-1">{getSubtitle()}</p>
        </div>

        {/* Form card */}
        <div className="card p-7">
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
              <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100 flex items-start gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-3 border border-green-100 flex items-start gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{success}</span>
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
          <div className="mt-6 pt-5 border-t border-gray-100 text-center flex flex-col gap-2.5">
            {mode === 'login' && (
              <>
                <p className="text-sm text-gray-500">
                  Hai ricevuto un invito?{' '}
                  <button
                    onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                    className="font-semibold text-[var(--club-red)] hover:underline underline-offset-2"
                  >
                    Registrati
                  </button>
                </p>
                <p className="text-sm text-gray-500">
                  <button
                    onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                    className="font-medium text-[var(--club-blue)] hover:underline underline-offset-2"
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
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  className="font-semibold text-[var(--club-red)] hover:underline underline-offset-2"
                >
                  Accedi
                </button>
              </p>
            )}

            {mode === 'forgot' && (
              <p className="text-sm text-gray-500">
                Ricordi la password?{' '}
                <button
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  className="font-semibold text-[var(--club-red)] hover:underline underline-offset-2"
                >
                  Torna al login
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Bottom brand */}
        <p className="text-center text-[11px] text-gray-400 mt-6 tracking-wide">
          EST. BELLUSCO · LOMBARDIA
        </p>
      </div>
    </div>
  );
}
