'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Plus, UserRound, X } from 'lucide-react';
import { groupRepo, profileRepo } from '@/lib/repositories';
import type { GroupMemberView } from '@/lib/repositories';
import { Spinner } from '@/components/UI';
import type { Profile } from '@/lib/database.types';

interface Props {
  group: Profile;
  /** Solo il maestro puo' modificare la composizione. */
  editable: boolean;
}

/**
 * Composizione di un gruppo, mostrata sotto la testata nella sua scheda.
 *
 * Sta chiusa di default: chi apre la scheda di un gruppo quasi sempre ci va
 * per gli obiettivi, non per l'elenco dei nomi. Il conteggio resta visibile
 * anche da chiusa, cosi' l'informazione piu' utile non richiede un click.
 */
export function GroupMembersPanel({ group, editable }: Props) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<GroupMemberView[]>([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [students, setStudents] = useState<Profile[]>([]);
  const [freeName, setFreeName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await groupRepo.listMembers(group.id);
    setMembers(res.data ?? []);
    setLoading(false);
  }, [group.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await groupRepo.listMembers(group.id);
      if (cancelled) return;
      setMembers(res.data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  // Gli allievi selezionabili si caricano solo quando servono davvero.
  useEffect(() => {
    if (!adding || students.length > 0) return;
    let cancelled = false;
    (async () => {
      const res = await profileRepo.listApprovedStudents();
      if (!cancelled) setStudents(res.data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [adding, students.length]);

  const alreadyIn = new Set(members.map((m) => m.studentId).filter(Boolean) as string[]);

  // Lo stesso campo di testo fa due mestieri: filtra gli allievi gia' a
  // sistema e, se non c'e' nessuna corrispondenza, diventa il nome libero da
  // aggiungere. Con ~300 allievi una lista senza filtro sarebbe inservibile,
  // e due input separati (uno "cerca", uno "scrivi") si somiglierebbero
  // troppo per capire al volo quale usare.
  const query = freeName.trim().toLowerCase();
  const selectable = students
    .filter((s) => !alreadyIn.has(s.id))
    .filter((s) => (query ? s.full_name.toLowerCase().includes(query) : true));

  // Se il testo scritto e' gia' il nome esatto di un allievo proposto, il
  // pulsante "+" creerebbe un doppione slegato dal profilo: meglio spingere
  // sulla voce in elenco.
  const collideConAllievo = selectable.some(
    (s) => s.full_name.toLowerCase() === query
  );

  const handleAddStudent = async (studentId: string) => {
    setBusy(true);
    setError(null);
    const res = await groupRepo.addStudent(group.id, studentId);
    if (res.error) setError(res.error.message);
    else await load();
    setBusy(false);
  };

  const handleAddName = async () => {
    const clean = freeName.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    const res = await groupRepo.addName(group.id, clean);
    if (res.error) setError(res.error.message);
    else {
      setFreeName('');
      await load();
    }
    setBusy(false);
  };

  const handleRemove = async (memberId: string) => {
    setBusy(true);
    setError(null);
    const res = await groupRepo.removeMember(memberId);
    if (res.error) setError(res.error.message);
    else await load();
    setBusy(false);
  };

  return (
    <div className="card p-0 overflow-hidden mb-5 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-muted transition-colors"
      >
        <UserRound size={16} strokeWidth={2.2} className="text-[var(--club-red)] shrink-0" />
        <span className="text-[13px] font-bold text-foreground">Partecipanti</span>
        <span className="text-[12px] font-semibold text-[var(--subtle-foreground)]">
          {loading ? '—' : members.length}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2.2}
          className={`ml-auto text-[var(--subtle-foreground)] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[var(--border-soft)] pt-3 flex flex-col gap-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : members.length === 0 ? (
            <p className="text-[12.5px] text-[var(--subtle-foreground)] leading-relaxed">
              Nessun partecipante. Il gruppo funziona lo stesso — gli obiettivi
              sono del gruppo, non dei singoli — ma l&apos;elenco aiuta a
              ricordare chi c&apos;&egrave;.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <span
                  key={m.id}
                  className={`inline-flex items-center gap-1.5 pl-2.5 py-1 rounded-lg text-[12px] font-semibold ${
                    editable ? 'pr-1.5' : 'pr-2.5'
                  } ${
                    m.studentId
                      ? 'bg-[var(--club-blue)]/8 text-[var(--club-blue)]'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                  title={m.studentId ? 'Allievo a sistema' : 'Nome libero'}
                >
                  {m.name}
                  {editable && (
                    <button
                      type="button"
                      onClick={() => handleRemove(m.id)}
                      disabled={busy}
                      className="opacity-45 hover:opacity-100 hover:text-destructive transition-all disabled:opacity-25"
                      aria-label={`Rimuovi ${m.name}`}
                    >
                      <X size={13} strokeWidth={2.6} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {editable && (
            <>
              {!adding ? (
                <button
                  type="button"
                  onClick={() => {
                    setFreeName('');
                    setAdding(true);
                  }}
                  className="self-start inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--club-blue)] hover:underline"
                >
                  <Plus size={14} strokeWidth={2.6} />
                  Aggiungi partecipante
                </button>
              ) : (
                <div className="flex flex-col gap-2.5 pt-1 max-w-xl">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={freeName}
                      onChange={(e) => setFreeName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddName();
                        }
                      }}
                      placeholder="Cerca un allievo, oppure scrivi un nome nuovo"
                      autoFocus
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-card text-[13px] text-foreground placeholder:text-[var(--subtle-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)]/10 focus:border-[var(--club-blue)] transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleAddName}
                      disabled={busy || !freeName.trim() || collideConAllievo}
                      title={
                        collideConAllievo
                          ? 'Questo allievo e\u0027 gia\u0027 in elenco qui sotto: aggiungilo da li\u0027 per collegarlo al suo profilo'
                          : 'Aggiungi come nome libero'
                      }
                      className="shrink-0 px-3 rounded-lg border border-border text-muted-foreground hover:border-[var(--club-blue)] hover:text-[var(--club-blue)] transition-colors disabled:opacity-40"
                      aria-label="Aggiungi nome"
                    >
                      <Plus size={16} strokeWidth={2.4} />
                    </button>
                  </div>

                  {selectable.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto rounded-lg border border-[var(--border-soft)] p-1">
                      {selectable.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleAddStudent(s.id)}
                          disabled={busy}
                          className="block w-full text-left px-2.5 py-2 rounded-md text-[12.5px] leading-5 text-foreground hover:bg-muted transition-colors disabled:opacity-40 truncate"
                        >
                          {s.full_name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[var(--subtle-foreground)] leading-relaxed">
                      {query
                        ? 'Nessun allievo con questo nome. Premi + per aggiungerlo come nome libero.'
                        : 'Tutti gli allievi sono gia\u0027 nel gruppo.'}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setFreeName('');
                    }}
                    className="self-start text-[12px] font-medium text-[var(--subtle-foreground)] hover:text-muted-foreground"
                  >
                    Chiudi
                  </button>
                </div>
              )}
            </>
          )}

          {error && <p className="text-[12px] font-medium text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
