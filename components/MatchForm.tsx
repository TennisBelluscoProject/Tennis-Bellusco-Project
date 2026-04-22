'use client';

import { useState, useEffect } from 'react';
import type { MatchResultRow, SurfaceType, MatchResult } from '@/lib/database.types';
import { SURFACE_LABELS, RESULT_LABELS, ROUNDS } from '@/lib/constants';
import { Button, Input, Textarea, Select, Checkbox, Modal } from './UI';

interface MatchFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<MatchResultRow>) => Promise<void>;
  match?: MatchResultRow | null;
}

export function MatchForm({ open, onClose, onSave, match }: MatchFormProps) {
  const [tournament, setTournament] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [opponent, setOpponent] = useState('');
  const [score, setScore] = useState('');
  const [result, setResult] = useState<MatchResult>('win');
  const [round, setRound] = useState('');
  const [surface, setSurface] = useState<SurfaceType>('terra_rossa');
  const [indoor, setIndoor] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (match) {
      setTournament(match.tournament_name || '');
      setMatchDate(match.match_date || '');
      setOpponent(match.opponent_name || '');
      setScore(match.score || '');
      setResult(match.result);
      setRound(match.round || '');
      setSurface(match.surface || 'terra_rossa');
      setIndoor(match.indoor || false);
      setNotes(match.notes || '');
    } else {
      setTournament('');
      setMatchDate(new Date().toISOString().split('T')[0]);
      setOpponent('');
      setScore('');
      setResult('win');
      setRound('');
      setSurface('terra_rossa');
      setIndoor(false);
      setNotes('');
    }
    setError('');
  }, [match, open]);

  const handleSubmit = async () => {
    if (!tournament.trim()) { setError('Inserisci il nome del torneo'); return; }
    if (!matchDate) { setError('Inserisci la data'); return; }

    setSaving(true);
    try {
      await onSave({
        tournament_name: tournament.trim(),
        match_date: matchDate,
        opponent_name: opponent.trim() || null,
        score: score.trim() || null,
        result,
        round: round || null,
        surface,
        indoor,
        notes: notes.trim() || null,
      });
      onClose();
    } catch {
      setError('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const surfaceOptions = Object.entries(SURFACE_LABELS).map(([k, v]) => ({ value: k, label: v }));
  const resultOptions = Object.entries(RESULT_LABELS).map(([k, v]) => ({ value: k, label: v }));
  const roundOptions = ROUNDS.map((r) => ({ value: r, label: r }));

  return (
    <Modal open={open} onClose={onClose} title={match ? 'Modifica match' : 'Aggiungi match'}>
      <div className="flex flex-col gap-4">
        <Input label="Torneo" value={tournament} onChange={setTournament} required placeholder="Es. Torneo Sociale Bellusco" />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Data" type="date" value={matchDate} onChange={setMatchDate} required />
          <Input label="Avversario" value={opponent} onChange={setOpponent} placeholder="Nome avversario" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Risultato" value={score} onChange={setScore} placeholder="Es. 6-3, 7-5" />
          <Select label="Esito" value={result} onChange={(v) => setResult(v as MatchResult)} options={resultOptions} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Superficie" value={surface} onChange={(v) => setSurface(v as SurfaceType)} options={surfaceOptions} />
          <Select label="Turno" value={round} onChange={setRound} options={roundOptions} placeholder="Seleziona turno" />
        </div>

        <Checkbox label="Indoor" checked={indoor} onChange={setIndoor} />

        <Textarea label="Note" value={notes} onChange={setNotes} placeholder="Annotazioni sul match..." />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button variant="primary" loading={saving} onClick={handleSubmit}>{match ? 'Salva modifiche' : 'Aggiungi match'}</Button>
        </div>
      </div>
    </Modal>
  );
}
