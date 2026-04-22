'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // The session should already be set by the auth/callback route
    // Verify we have a valid session
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (data.user) {
        setSessionReady(true);
      } else {
        setError('Sessione non valida. Richiedi un nuovo link di reset.');
      }
    });
    return () => { cancelled = true; };
  }, [supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La password deve avere almeno 6 caratteri');
      return;
    }

    if (password !== confirmPassword) {
      setError('Le password non corrispondono');
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
    }

    setLoading(false);
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
            Nuova Password
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Inserisci la tua nuova password
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {success ? (
            <div className="text-center">
              <div className="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-3 border border-green-100 mb-4">
                Password aggiornata con successo!
              </div>
              <Link
                href="/"
                className="inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 bg-club-red text-white hover:bg-club-red-dark shadow-sm text-base px-6 py-3 w-full mt-2"
              >
                Vai al login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Nuova password
                  <span className="text-[var(--club-red)] ml-0.5">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 6 caratteri"
                  required
                  disabled={!sessionReady}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)] focus:border-transparent transition-all disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Conferma password
                  <span className="text-[var(--club-red)] ml-0.5">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ripeti la password"
                  required
                  disabled={!sessionReady}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)] focus:border-transparent transition-all disabled:opacity-50"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !sessionReady}
                className="inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 bg-[var(--club-red)] text-white hover:bg-[var(--club-red-dark)] shadow-sm text-base px-6 py-3 w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <svg
                    className="animate-spin h-4 w-4 mr-2"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : null}
                Aggiorna password
              </button>
            </form>
          )}
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
