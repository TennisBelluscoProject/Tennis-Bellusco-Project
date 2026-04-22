'use client';

import { useState, useEffect } from 'react';
import { Button, Textarea, Modal } from './UI';

interface CoachNotesFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (notes: string) => Promise<void>;
  currentNotes?: string | null;
  title?: string;
}

export function CoachNotesForm({ open, onClose, onSave, currentNotes, title = 'Note del maestro' }: CoachNotesFormProps) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotes(currentNotes || '');
  }, [currentNotes, open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(notes.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        <Textarea
          label="Note (visibili all'allievo)"
          value={notes}
          onChange={setNotes}
          placeholder="Scrivi le tue note..."
          rows={5}
        />
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button variant="secondary" loading={saving} onClick={handleSave}>Salva note</Button>
        </div>
      </div>
    </Modal>
  );
}
