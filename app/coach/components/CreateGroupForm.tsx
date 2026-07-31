'use client';

import { useEffect, useState } from 'react';
import { Plus, Users, X } from 'lucide-react';
import { groupRepo, profileRepo } from '@/lib/repositories';
import { Button, Input, Modal, SearchBar, Spinner } from '@/components/UI';
import type { Profile } from '@/lib/database.types';

interface Props {
  open: boolean;
  coachId: string | null;
  onClose: () => void;
  onCreated: (created: Profile) => void;
}

export function CreateGroupForm({ open, coachId, onClose, onCreated }: Props) {
  if (!open) return null;
  return <CreateGroupFormBody coachId={coachId} onClose={onClose} onCreated={onCreated} />;
}

function CreateGroupFormBody({
  coachId,
  onClose,
  onCreated,
}: {
  coachId: string | null;
  onClose: () => void;
  onCreated: (created: Profile) => void;
}) {
  const [name, setName] = useState('');

  const [students, setStudents] = useState<Profile[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Partecipanti senza profilo: solo un nome.
  const [freeName, setFreeName] = useState('');
  const [freeNames, setFreeNames] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await profileRepo.listApprovedStudents();
      if (cancelled) return;
      setStudents(res.data ?? []);
      setLoadingStudents(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = students.filter((s) =>
    s.full_name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const togglePicked = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addFreeName = () => {
    const clean = freeName.trim();
    if (!clean) return;
    setFreeNames((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setFreeName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError('');

    const cleanName = name.trim();
    if (!cleanName) return setError('Dai un nome al gruppo');

    setSaving(true);

    const created = await groupRepo.create({ coachId, name: cleanName });
    if (created.error || !created.data) {
      setError(created.error?.message ?? 'Creazione non riuscita');
      setSaving(false);
      return;
    }
    const group = created.data;

    // I partecipanti si aggiungono dopo: se qualcuno fallisce il gruppo resta
    // creato e il maestro puo' sistemarlo dalla scheda, invece di perdere
    // tutto e dover ricominciare.
    const outcomes = await Promise.all([
      ...[...picked].map((sid) => groupRepo.addStudent(group.id, sid)),
      ...freeNames.map((n) => groupRepo.addName(group.id, n)),
    ]);
    const failed = outcomes.filter((r) => r.error).length;

    setSaving(false);
    onCreated(group);
    onClose();

    if (failed > 0) {
      // Non blocchiamo la chiusura: il gruppo c'e'. Segnaliamo e basta.
      console.warn(`[gruppi] ${failed} partecipanti non aggiunti al gruppo ${group.id}`);
    }
  };

  const totalPicked = picked.size + freeNames.length;

  return (
    <Modal open onClose={onClose} title="Nuovo gruppo">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="bg-red-50/50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <Users size={16} strokeWidth={2.2} className="shrink-0 mt-0.5 text-[var(--club-red)]" />
          <p className="text-[12px] text-gray-700 leading-relaxed">
            Un gruppo funziona come un allievo: potrai assegnargli obiettivi,
            percorsi e i 12 passi. Metti l&apos;orario nel nome, cos&igrave; lo
            riconosci al volo (es. <b>U12 Lun/Mer 17:00</b>).
          </p>
        </div>

        <Input
          label="Nome del gruppo"
          value={name}
          onChange={setName}
          placeholder="es. U12 Lun/Mer 17:00"
          required
        />

        {/* ── Partecipanti gia' a sistema ── */}
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-semibold text-gray-700 tracking-[-0.01em]">
            Partecipanti
            {totalPicked > 0 && (
              <span className="ml-1.5 text-[11px] font-bold text-[var(--club-blue)]">
                {totalPicked} selezionati
              </span>
            )}
          </label>

          <SearchBar value={search} onChange={setSearch} placeholder="Cerca allievo..." />

          <div className="max-h-[30vh] overflow-y-auto flex flex-col gap-1 border border-gray-100 rounded-xl p-1.5">
            {loadingStudents ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-[13px] text-gray-400 text-center py-5">
                Nessun allievo trovato.
              </p>
            ) : (
              filtered.map((s) => {
                const on = picked.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => togglePicked(s.id)}
                    className={`shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                      on ? 'bg-[var(--club-blue)]/8' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                        on
                          ? 'bg-[var(--club-blue)] border-[var(--club-blue)]'
                          : 'border-gray-300'
                      }`}
                    >
                      {on && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span className="text-[13px] font-medium text-gray-800 truncate">
                      {s.full_name}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Partecipanti senza profilo ── */}
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-semibold text-gray-700 tracking-[-0.01em]">
            Aggiungi un nome
            <span className="ml-1.5 text-[11px] font-normal text-gray-400">
              per chi non ha ancora un profilo
            </span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={freeName}
              onChange={(e) => setFreeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addFreeName();
                }
              }}
              placeholder="es. Luca B."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)]/10 focus:border-[var(--club-blue)] transition-all duration-200"
            />
            <button
              type="button"
              onClick={addFreeName}
              className="shrink-0 px-3 rounded-xl border border-gray-200 text-gray-500 hover:border-[var(--club-blue)] hover:text-[var(--club-blue)] transition-colors"
              aria-label="Aggiungi nome"
            >
              <Plus size={18} strokeWidth={2.4} />
            </button>
          </div>

          {freeNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {freeNames.map((n) => (
                <span
                  key={n}
                  className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-gray-100 text-[12px] font-semibold text-gray-700"
                >
                  {n}
                  <button
                    type="button"
                    onClick={() => setFreeNames((prev) => prev.filter((x) => x !== n))}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    aria-label={`Rimuovi ${n}`}
                  >
                    <X size={13} strokeWidth={2.6} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end mt-1">
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button type="submit" variant="secondary" loading={saving}>
            Crea gruppo
          </Button>
        </div>
      </form>
    </Modal>
  );
}
