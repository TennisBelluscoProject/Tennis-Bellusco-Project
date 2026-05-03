'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button, Input } from '@/components/UI';

type Mode = 'login' | 'register' | 'verify-email' | 'forgot';

export function LoginPage() {
  const { signIn, signUp, verifySignupOtp, resendSignupOtp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [ranking, setRanking] = useState('');
  const [unranked, setUnranked] = useState(true);
  const [level, setLevel] = useState<'Principiante' | 'Intermedio' | 'Avanzato'>('Principiante');
  const [confirmPassword, setConfirmPassword] = useState('');

  // OTP verification
  const [otpCode, setOtpCode] = useState('');
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('error');
    if (authError === 'auth_callback_error') {
      queueMicrotask(() => {
        setError('Errore di autenticazione. Il link potrebbe essere scaduto, riprova.');
      });
    }
  }, []);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setSuccess('');
  };

  // ─── Handlers ─────────────────────────────────────────
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

    if (!firstName.trim()) return setError('Inserisci il nome');
    if (!lastName.trim()) return setError('Inserisci il cognome');

    if (!birthDate) return setError('Inserisci la data di nascita');
    const birthTs = new Date(birthDate).getTime();
    if (Number.isNaN(birthTs)) return setError('Data di nascita non valida');
    const minTs = new Date('1900-01-01').getTime();
    const maxTs = Date.now();
    if (birthTs < minTs || birthTs > maxTs) {
      return setError('Inserisci una data di nascita valida');
    }
    if (!unranked && !ranking.trim()) {
      return setError('Inserisci la classifica FIT oppure spunta "Non classificato"');
    }
    if (password.length < 6) return setError('La password deve avere almeno 6 caratteri');
    if (password !== confirmPassword) return setError('Le password non coincidono');

    setSubmitting(true);
    const { error: err } = await signUp({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate,
      ranking: unranked ? 'Non classificato' : ranking.trim(),
      level: unranked ? level : 'Principiante',
      email: email.trim(),
      password,
    });
    if (err) {
      setError(err);
      setSubmitting(false);
      return;
    }
    setOtpCode('');
    setMode('verify-email');
    setSuccess(`Codice inviato a ${email.trim()}`);
    setResendCooldown(45);
    setSubmitting(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    const code = otpCode.replace(/\D/g, '');
    if (code.length !== 6) return setError('Il codice deve essere di 6 cifre');

    setSubmitting(true);
    const { error: err } = await verifySignupOtp(email.trim(), code);
    if (err) {
      setError(err);
      setSubmitting(false);
      return;
    }
    // On success, AuthContext will pick up SIGNED_IN and show PendingApprovalScreen.
  };

  const handleResendOtp = async () => {
    if (resending || resendCooldown > 0) return;
    setError('');
    setSuccess('');
    setResending(true);
    const { error: err } = await resendSignupOtp(email.trim());
    if (err) setError(err);
    else {
      setSuccess(`Codice reinviato a ${email.trim()}`);
      setResendCooldown(45);
    }
    setResending(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email.trim()) return setError('Inserisci la tua email');

    setSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (resetError) setError(resetError.message);
    else setSuccess('Email di reset inviata. Controlla la posta e clicca sul link per reimpostare la password.');
    setSubmitting(false);
  };

  // ─── Page chrome ──────────────────────────────────────
  const getTitle = () => {
    if (mode === 'login') return 'Bentornato';
    if (mode === 'register') return 'Crea il tuo account';
    if (mode === 'verify-email') return 'Verifica la tua email';
    return 'Recupera la password';
  };
  const getSubtitle = () => {
    if (mode === 'login') return 'Accedi al tuo profilo tennistico';
    if (mode === 'register') return 'Compila i tuoi dati per richiedere l’accesso';
    if (mode === 'verify-email') return 'Inserisci il codice a 6 cifre ricevuto via email';
    return 'Ti invieremo un link per reimpostarla';
  };

  return (
    <div className="login-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px] relative z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <Image
            src="/logo-login.png"
            alt="Tennis Bellusco 2012"
            width={146}
            height={72}
            priority
            className="mx-auto mb-3 object-contain"
          />
          <div className="flex justify-center mt-3 mb-4 gap-1">
            <div className="w-8 h-[3px] rounded-full bg-[var(--club-red)]" />
            <div className="w-8 h-[3px] rounded-full bg-gray-200" />
            <div className="w-8 h-[3px] rounded-full bg-[var(--club-blue)]" />
          </div>
          <p className="text-lg font-semibold text-gray-900 tracking-[-0.01em]" style={{ fontFamily: 'var(--font-display)' }}>
            {getTitle()}
          </p>
          <p className="text-[13px] text-gray-500 mt-1">{getSubtitle()}</p>
        </div>

        {/* Mode toggle (login / register only) */}
        {(mode === 'login' || mode === 'register') && (
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

        <div className="card p-6">
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="la-tua@email.com" required />
              <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" required />

              {error && <ErrorBox message={error} />}

              <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full mt-1">
                Accedi
              </Button>

              <div className="text-center mt-1">
                <button type="button" onClick={() => switchMode('forgot')} className="text-sm font-medium text-[var(--club-blue)] hover:underline underline-offset-2">
                  Password dimenticata?
                </button>
              </div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Nome" value={firstName} onChange={setFirstName} placeholder="Mario" required />
                <Input label="Cognome" value={lastName} onChange={setLastName} placeholder="Rossi" required />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-gray-700 tracking-[-0.01em]">
                  Data di nascita<span className="text-[var(--club-red)] ml-0.5">*</span>
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  min="1900-01-01"
                  max={new Date().toISOString().slice(0, 10)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)]/10 focus:border-[var(--club-blue)] transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-gray-700 tracking-[-0.01em]">
                  Classifica FIT<span className="text-[var(--club-red)] ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={unranked ? '' : ranking}
                  onChange={(e) => setRanking(e.target.value)}
                  placeholder={unranked ? 'Non classificato' : 'es. 3.5'}
                  disabled={unranked}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)]/10 focus:border-[var(--club-blue)] transition-all duration-200 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none -mt-1">
                <input
                  type="checkbox"
                  checked={unranked}
                  onChange={(e) => setUnranked(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[var(--club-blue)] focus:ring-[var(--club-blue)]"
                />
                <span className="text-[13px] text-gray-600">Non sono classificato FIT</span>
              </label>

              {unranked && (
                <div className="flex flex-col gap-1.5 -mt-1">
                  <label className="text-[13px] font-semibold text-gray-700 tracking-[-0.01em]">
                    Livello tecnico<span className="text-[var(--club-red)] ml-0.5">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Principiante', 'Intermedio', 'Avanzato'] as const).map((opt) => {
                      const active = level === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setLevel(opt)}
                          className={`py-2 rounded-xl border text-[13px] font-semibold transition-all ${
                            active
                              ? 'bg-[var(--club-blue)] text-white border-[var(--club-blue)] shadow-sm'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="la-tua@email.com" required />

              <div className="grid grid-cols-1 gap-3">
                <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="Minimo 6 caratteri" required />
                <Input label="Conferma password" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Ripeti la password" required />
              </div>

              <div className="bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A5C" strokeWidth="2" className="shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <p className="text-[12px] text-[var(--club-blue)] leading-relaxed">
                  Riceverai un codice a 6 cifre via email per verificare l’account. Dopo la verifica, l’accesso sarà sbloccato dal maestro.
                </p>
              </div>

              {error && <ErrorBox message={error} />}

              <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full mt-1">
                Crea account
              </Button>
            </form>
          )}

          {mode === 'verify-email' && (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <div className="text-center mb-1">
                <div className="w-14 h-14 rounded-2xl bg-[var(--club-blue-light)] flex items-center justify-center mx-auto mb-3">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--club-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  Abbiamo inviato un codice a <strong className="text-gray-900 break-all">{email}</strong>
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-gray-700 tracking-[-0.01em] text-center">
                  Codice di verifica
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-center text-2xl font-bold tracking-[0.4em] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)]/10 focus:border-[var(--club-blue)] transition-all duration-200"
                />
              </div>

              {error && <ErrorBox message={error} />}
              {success && !error && <SuccessBox message={success} />}

              <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full mt-1">
                Verifica codice
              </Button>

              <div className="flex items-center justify-between text-[13px] mt-1">
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-gray-500 hover:text-gray-700 font-medium"
                >
                  ← Indietro
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending || resendCooldown > 0}
                  className="font-semibold text-[var(--club-blue)] hover:underline underline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:no-underline"
                >
                  {resendCooldown > 0 ? `Reinvia (${resendCooldown}s)` : resending ? 'Invio...' : 'Reinvia codice'}
                </button>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
              <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="la-tua@email.com" required />

              {error && <ErrorBox message={error} />}
              {success && <SuccessBox message={success} />}

              <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full mt-1">
                Invia link di reset
              </Button>

              <div className="text-center mt-1">
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
