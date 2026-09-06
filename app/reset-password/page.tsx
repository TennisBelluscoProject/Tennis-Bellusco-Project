'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Input, Spinner } from '@/components/UI';

type Status = 'checking' | 'ready' | 'invalid' | 'done';

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;
    // La sessione la apre gia' la route auth/callback: qui si controlla solo
    // che il link fosse valido, altrimenti il form non ha niente da aggiornare.
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setStatus(data.user ? 'ready' : 'invalid');
    });
    return () => {
      cancelled = true;
    };
  }, [supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    if (password.length < 6) return setError('La password deve avere almeno 6 caratteri');
    if (password !== confirmPassword) return setError('Le password non coincidono');

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }
    setStatus('done');
    setSubmitting(false);
  };

  const getTitle = () => {
    if (status === 'done') return 'Password aggiornata';
    if (status === 'invalid') return 'Link non più valido';
    return 'Nuova password';
  };
  const getSubtitle = () => {
    if (status === 'done') return 'Da ora accedi con la password appena scelta';
    if (status === 'invalid') return 'Richiedi un nuovo link di reset dal login';
    return 'Scegli la password con cui accederai da ora in poi';
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
            <div className="w-8 h-[3px] rounded-full bg-[var(--secondary-hover)]" />
            <div className="w-8 h-[3px] rounded-full bg-[var(--club-blue)]" />
          </div>
          <p
            className="text-lg font-semibold text-foreground tracking-[-0.01em]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {getTitle()}
          </p>
          <p className="text-[13px] text-muted-foreground mt-1">{getSubtitle()}</p>
        </div>

        <div className="card p-6">
          {status === 'checking' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Spinner size={24} />
              <p className="text-[13px] text-muted-foreground">Verifica del link in corso…</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="flex flex-col gap-4">
              <div className="text-center mb-1">
                <div className="w-14 h-14 rounded-2xl bg-destructive-soft flex items-center justify-center mx-auto mb-3">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--destructive)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                  </svg>
                </div>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  Il link di reset è scaduto o è già stato usato. Torna al login e richiedine uno nuovo.
                </p>
              </div>

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => router.push('/')}
              >
                Torna al login
              </Button>
            </div>
          )}

          {status === 'done' && (
            <div className="flex flex-col gap-4">
              <div className="text-center mb-1">
                <div className="w-14 h-14 rounded-2xl bg-success-soft flex items-center justify-center mx-auto mb-3">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--success)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  La tua password è stata aggiornata. Puoi tornare all’app e continuare a giocare.
                </p>
              </div>

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => router.push('/')}
              >
                Vai all’app
              </Button>
            </div>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Nuova password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="Minimo 6 caratteri"
                required
              />
              <Input
                label="Conferma password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Ripeti la password"
                required
              />

              {error && <ErrorBox message={error} />}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={submitting}
                className="w-full mt-1"
              >
                Aggiorna password
              </Button>

              <div className="text-center mt-1">
                <Link
                  href="/"
                  className="text-sm font-medium text-[var(--club-blue)] hover:underline underline-offset-2"
                >
                  Torna al login
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-[var(--subtle-foreground)] mt-6 tracking-wide">
          EST. BELLUSCO · LOMBARDIA
        </p>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-destructive-soft text-destructive text-sm rounded-xl px-4 py-3 border border-[color-mix(in_srgb,var(--destructive)_24%,transparent)] flex items-start gap-2.5">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="shrink-0 mt-0.5"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
