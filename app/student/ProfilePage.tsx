'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/UI';
import type { Profile } from '@/lib/database.types';
import { getDisplayRanking, getAgeCategory, isClassified } from '@/lib/constants';

interface ProfilePageProps {
  onBack: () => void;
}

type EditMode = null | 'all' | 'classifica' | 'birth' | 'password';

export function ProfilePage({ onBack }: ProfilePageProps) {
  const { profile, refreshProfile, signOut } = useAuth();
  const [editing, setEditing] = useState<EditMode>(null);

  if (!profile) return null;

  const { displayLevel, displayRanking } = getDisplayRanking(profile);
  const classified = isClassified(displayRanking);
  const ageCategory = getAgeCategory(profile.birth_date);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-30 bg-white/98 backdrop-blur-lg border-b border-gray-100/80">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-gray-500 hover:text-[var(--club-blue)] transition-colors"
            aria-label="Indietro"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-[14px] font-semibold">Profilo</span>
          </button>
          <div className="w-9 h-9 rounded-xl bg-[var(--club-red)] flex items-center justify-center shadow-sm shrink-0">
            <span className="text-lg">🎾</span>
          </div>
        </div>
      </header>
      <div className="club-stripe" />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Avatar card */}
        <div className="card p-7 text-center mb-5 animate-slide-up">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--club-blue)] to-[var(--club-blue-dark)] flex items-center justify-center text-white text-3xl font-bold shadow-md mx-auto mb-4">
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <h2
            className="text-xl font-bold text-gray-900 tracking-[-0.02em]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {profile.full_name}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5">
            {ageCategory && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--club-blue-light)] text-[var(--club-blue)]">
                {ageCategory}
              </span>
            )}
            {classified ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--club-red-light)] text-[var(--club-red)]">
                FIT {displayRanking}
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-orange-50 text-orange-700">
                {displayLevel}
              </span>
            )}
          </div>
          <button
            onClick={() => setEditing('all')}
            className="mt-5 px-5 py-2 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Modifica profilo
          </button>
        </div>

        {/* Editable rows */}
        <div className="flex flex-col gap-2 mb-6">
          <ProfileRow
            label="Classifica FIT"
            value={classified ? displayRanking : 'Non classificato'}
            onClick={() => setEditing('classifica')}
          />
          {!classified && (
            <ProfileRow
              label="Livello di gioco"
              value={displayLevel}
              onClick={() => setEditing('classifica')}
            />
          )}
          <ProfileRow
            label="Data di nascita"
            value={profile.birth_date ? formatDateIt(profile.birth_date) : 'Non impostata'}
            onClick={() => setEditing('birth')}
          />
          <ProfileRow
            label="Email"
            value={profile.email || '—'}
            readOnly
            hint="Non modificabile"
          />
          <ProfileRow
            label="Password"
            value="••••••••"
            onClick={() => setEditing('password')}
          />
        </div>

        <button
          onClick={signOut}
          className="w-full py-3.5 rounded-2xl bg-[var(--club-red-light)] text-[var(--club-red)] font-bold text-[15px] hover:bg-red-100 transition-colors"
        >
          Esci dall&apos;account
        </button>
      </main>

      {editing === 'all' && (
        <EditAllModal
          profile={profile}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refreshProfile();
            setEditing(null);
          }}
        />
      )}
      {editing === 'classifica' && (
        <EditClassificaModal
          profile={profile}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refreshProfile();
            setEditing(null);
          }}
        />
      )}
      {editing === 'birth' && (
        <EditBirthModal
          profile={profile}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refreshProfile();
            setEditing(null);
          }}
        />
      )}
      {editing === 'password' && (
        <EditPasswordModal onClose={() => setEditing(null)} email={profile.email ?? ''} />
      )}
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────

function ProfileRow({
  label,
  value,
  onClick,
  readOnly,
  hint,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  readOnly?: boolean;
  hint?: string;
}) {
  const Inner = (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-white border border-gray-100 rounded-2xl transition-colors hover:border-gray-200">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-[15px] font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
      </div>
      {!readOnly && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </div>
  );
  if (readOnly || !onClick) return Inner;
  return (
    <button onClick={onClick} className="text-left w-full">
      {Inner}
    </button>
  );
}

// ─── Modals ──────────────────────────────────────────────

interface ModalShellProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

function ModalShell({ title, children, onClose }: ModalShellProps) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-content animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 tracking-[-0.01em]">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">
      {message}
    </div>
  );
}

function ClassificaFields({
  unranked,
  setUnranked,
  ranking,
  setRanking,
  level,
  setLevel,
}: {
  unranked: boolean;
  setUnranked: (v: boolean) => void;
  ranking: string;
  setRanking: (v: string) => void;
  level: string;
  setLevel: (v: string) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-semibold text-gray-700">Classifica FIT</label>
        <input
          type="text"
          value={unranked ? '' : ranking}
          onChange={(e) => setRanking(e.target.value)}
          placeholder={unranked ? 'Non classificato' : 'es. 3.5'}
          disabled={unranked}
          className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[var(--club-blue)] disabled:bg-gray-50 disabled:text-gray-400"
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
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-gray-700">Livello tecnico</label>
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
    </>
  );
}

function EditAllModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: () => void }) {
  const initialClassified = isClassified(profile.ranking);
  const [unranked, setUnranked] = useState(!initialClassified);
  const [ranking, setRanking] = useState(initialClassified ? profile.ranking : '');
  const [level, setLevel] = useState(profile.level || 'Principiante');
  const [birthDate, setBirthDate] = useState(profile.birth_date ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setBusy(true);
    setError('');
    if (!unranked && !ranking.trim()) {
      setError('Inserisci la classifica FIT o spunta "Non classificato"');
      setBusy(false);
      return;
    }
    if (birthDate) {
      const ts = new Date(birthDate).getTime();
      if (Number.isNaN(ts)) {
        setError('Data di nascita non valida');
        setBusy(false);
        return;
      }
    }
    const { error: e } = await supabase
      .from('profiles')
      .update({
        ranking: unranked ? 'Non classificato' : ranking.trim(),
        level: unranked ? level : 'Principiante',
        birth_date: birthDate || null,
      })
      .eq('id', profile.id);
    if (e) {
      setError(e.message);
      setBusy(false);
      return;
    }
    onSaved();
  };

  return (
    <ModalShell title="Modifica profilo" onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <ClassificaFields
          unranked={unranked}
          setUnranked={setUnranked}
          ranking={ranking}
          setRanking={setRanking}
          level={level}
          setLevel={setLevel}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-gray-700">Data di nascita</label>
          <input
            type="date"
            value={birthDate ?? ''}
            onChange={(e) => setBirthDate(e.target.value)}
            min="1900-01-01"
            max={new Date().toISOString().slice(0, 10)}
            className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[var(--club-blue)]"
          />
        </div>
        {error && <ErrorBox message={error} />}
        <div className="flex gap-3 justify-end mt-1">
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button variant="primary" loading={busy} onClick={handleSave}>Salva</Button>
        </div>
      </div>
    </ModalShell>
  );
}

function EditClassificaModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: () => void }) {
  const initialClassified = isClassified(profile.ranking);
  const [unranked, setUnranked] = useState(!initialClassified);
  const [ranking, setRanking] = useState(initialClassified ? profile.ranking : '');
  const [level, setLevel] = useState(profile.level || 'Principiante');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setBusy(true);
    setError('');
    if (!unranked && !ranking.trim()) {
      setError('Inserisci la classifica FIT o spunta "Non classificato"');
      setBusy(false);
      return;
    }
    const { error: e } = await supabase
      .from('profiles')
      .update({
        ranking: unranked ? 'Non classificato' : ranking.trim(),
        level: unranked ? level : 'Principiante',
      })
      .eq('id', profile.id);
    if (e) {
      setError(e.message);
      setBusy(false);
      return;
    }
    onSaved();
  };

  return (
    <ModalShell title="Classifica e livello" onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <ClassificaFields
          unranked={unranked}
          setUnranked={setUnranked}
          ranking={ranking}
          setRanking={setRanking}
          level={level}
          setLevel={setLevel}
        />
        {error && <ErrorBox message={error} />}
        <div className="flex gap-3 justify-end mt-1">
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button variant="primary" loading={busy} onClick={handleSave}>Salva</Button>
        </div>
      </div>
    </ModalShell>
  );
}

function EditBirthModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: () => void }) {
  const [birthDate, setBirthDate] = useState(profile.birth_date ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (birthDate) {
      const ts = new Date(birthDate).getTime();
      if (Number.isNaN(ts)) {
        setError('Data di nascita non valida');
        return;
      }
    }
    setBusy(true);
    const { error: e } = await supabase
      .from('profiles')
      .update({ birth_date: birthDate || null })
      .eq('id', profile.id);
    if (e) {
      setError(e.message);
      setBusy(false);
      return;
    }
    onSaved();
  };

  return (
    <ModalShell title="Data di nascita" onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <input
          type="date"
          value={birthDate ?? ''}
          onChange={(e) => setBirthDate(e.target.value)}
          min="1900-01-01"
          max={new Date().toISOString().slice(0, 10)}
          className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[var(--club-blue)]"
        />
        {error && <ErrorBox message={error} />}
        <div className="flex gap-3 justify-end mt-1">
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button variant="primary" loading={busy} onClick={handleSave}>Salva</Button>
        </div>
      </div>
    </ModalShell>
  );
}

function EditPasswordModal({ onClose, email }: { onClose: () => void; email: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (next.length < 6) return setError('La nuova password deve avere almeno 6 caratteri');
    if (next !== confirm) return setError('Le due password non coincidono');

    setBusy(true);

    // Verify current password by attempting to sign-in with it.
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: current });
    if (verifyErr) {
      setError('La password attuale non è corretta');
      setBusy(false);
      return;
    }
    // Update to new password
    const { error: updateErr } = await supabase.auth.updateUser({ password: next });
    if (updateErr) {
      setError(updateErr.message);
      setBusy(false);
      return;
    }
    setSuccess('Password aggiornata');
    setBusy(false);
    setTimeout(onClose, 800);
  };

  return (
    <ModalShell title="Cambia password" onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-gray-700">Password attuale</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[var(--club-blue)]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-gray-700">Nuova password</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[var(--club-blue)]" placeholder="Minimo 6 caratteri" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-gray-700">Conferma nuova password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[var(--club-blue)]" />
        </div>
        {error && <ErrorBox message={error} />}
        {success && (
          <div className="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-3 border border-green-100">
            {success}
          </div>
        )}
        <div className="flex gap-3 justify-end mt-1">
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button variant="primary" loading={busy} onClick={handleSave}>Aggiorna</Button>
        </div>
      </div>
    </ModalShell>
  );
}

function formatDateIt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}
