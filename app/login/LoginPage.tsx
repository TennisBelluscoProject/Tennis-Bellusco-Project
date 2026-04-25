'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button, Input } from '@/components/UI';

type Mode = 'login' | 'register' | 'forgot';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [registrationDone, setRegistrationDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('error');
    if (authError === 'auth_callback_error') {
      queueMicrotask(() => {
        setError('Errore di autenticazione. Il link potrebbe essere scaduto, riprova.');
      });
    }
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setSuccess('');
    setRegistrationDone(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err);
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSuccess('');

    if (!fullName.trim()) {
      setError('Inserisci nome e cognome');
      return;
    }
    if (password.length < 6) {
      setError('La password deve avere almeno 6 caratteri');
      return;
    }
    if (password !== confirmPassword) {
      setError('Le password non coincidono');
      return;
    }

    setSubmitting(true);
    const { error: err } = await signUp(email, password, fullName);
    if (err) {
      setError(err);
    } else {
      setRegistrationDone(true);
    }
    setSubmitting(false);
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
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (resetError) setError(resetError.message);
    else setSuccess('Email di reset inviata. Controlla la posta e clicca sul link per reimpostare la password.');
    setSubmitting(false);
  };

  // ─── Registration success screen ─────────────────────
  if (registrationDone) {
    return (
      <div className="login-bg flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px] relative z-10">
          <div className="card p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-5">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2 tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
              Registrazione inviata
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Il tuo account è stato creato ed è in <strong>attesa di approvazione</strong> da parte del maestro.
              Riceverai accesso non appena verrai accettato.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Email registrata</p>
              <p className="text-sm font-medium text-gray-800 break-all">{email}</p>
            </div>
            <Button variant="secondary" size="lg" className="w-full" onClick={() => { switchMode('login'); setEmail(''); setPassword(''); setConfirmPassword(''); setFullName(''); }}>
              Torna al login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const getTitle = () => {
    if (mode === 'login') return 'Bentornato';
    if (mode === 'register') return 'Crea il tuo account';
    return 'Recupera la password';
  };

  const getSubtitle = () => {
    if (mode === 'login') return 'Accedi al tuo profilo tennistico';
    if (mode === 'register') return 'Registrati per richiedere l’accesso al club';
    return 'Ti invieremo un link per reimpostarla';
  };

  return (
    <div className="login-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px] relative z-10">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[var(--club-red)] flex items-center justify-center mx-auto mb-5 shadow-lg relative overflow-hidden">
            <span className="text-3xl relative z-10">🎾</span>
            <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent" />
          </div>
          <h1 className="text-[28px] font-bold text-[var(--club-blue)] tracking-[-0.02em] mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            Tennis Club Bellusco
          </h1>
          <div className="flex justify-center mt-4 mb-5 gap-1">
            <div className="w-8 h-[3px] rounded-full bg-[var(--club-red)]" />
            <div className="w-8 h-[3px] rounded-full bg-gray-200" />
            <div className="w-8 h-[3px] rounded-full bg-[var(--club-blue)]" />
          </div>
          <p className="text-xl font-semibold text-gray-900 tracking-[-0.01em]" style={{ fontFamily: 'var(--font-display)' }}>
            {getTitle()}
          </p>
          <p className="text-sm text-gray-500 mt-1">{getSubtitle()}</p>
        </div>

        {/* Mode toggle (login / register) */}
        {mode !== 'forgot' && (
          <div className="flex gap-1 p-1 bg-gray-100/80 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 text-[13px] font-semibold py-2 rounded-lg transition-all duration-200 ${
                mode === 'login' ? 'bg-white text-[var(--club-blue)] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Accedi
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 text-[13px] font-semibold py-2 rounded-lg transition-all duration-200 ${
                mode === 'register' ? 'bg-white text-[var(--club-blue)] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Registrati
            </button>
          </div>
        )}

        <div className="card p-7">
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="la-tua@email.com" required />
              <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" required />

              {error && <ErrorBox message={error} />}

              <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full mt-2">
                Accedi
              </Button>

              <div className="text-center mt-2">
                <button type="button" onClick={() => switchMode('forgot')} className="text-sm font-medium text-[var(--club-blue)] hover:underline underline-offset-2">
                  Password dimenticata?
                </button>
              </div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <Input label="Nome e Cognome" value={fullName} onChange={setFullName} placeholder="Mario Rossi" required />
              <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="la-tua@email.com" required />
              <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="Minimo 6 caratteri" required />
              <Input label="Conferma password" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Ripeti la password" required />

              <div className="bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A5C" strokeWidth="2" className="shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <p className="text-[12px] text-[var(--club-blue)] leading-relaxed">
                  Dopo la registrazione il tuo account resterà <strong>in attesa di approvazione</strong> da parte del maestro.
                </p>
              </div>

              {error && <ErrorBox message={error} />}

              <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full mt-1">
                Crea account
              </Button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
              <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="la-tua@email.com" required />

              {error && <ErrorBox message={error} />}
              {success && <SuccessBox message={success} />}

              <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full mt-2">
                Invia link di reset
              </Button>

              <div className="text-center mt-2">
                <button type="button" onClick={() => switchMode('login')} className="text-sm font-medium text-[var(--club-blue)] hover:underline underline-offset-2">
                  Torna al login
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-6 tracking-wide">
          EST. BELLUSCO · LOMBARDIA
        </p>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100 flex items-start gap-2.5">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

function SuccessBox({ message }: { message: string }) {
  return (
    <div className="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-3 border border-green-100 flex items-start gap-2.5">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
