'use client';

import { FIT_RANKING_GROUPS, isValidFitRanking } from '@/lib/constants';

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Classi del <select>, per adattarlo al form che lo ospita. */
  className?: string;
  id?: string;
}

/**
 * Scelta della classifica FIT.
 *
 * Era un campo di testo libero in tre punti diversi (registrazione, creazione
 * allievo da parte del maestro, modifica del profilo): tre occasioni per
 * scrivere una classifica che non esiste. Ora si sceglie da un elenco chiuso,
 * raggruppato per categoria come sulla tessera federale.
 *
 * IL VALORE GIA' SALVATO NON SI PERDE MAI. Se in banca dati c'e' qualcosa che
 * non e' nell'elenco — scritto quando il campo era libero — resta come voce
 * in fondo, segnalata: nasconderlo vorrebbe dire mostrare una tendina vuota e
 * riscrivere di nascosto la classifica di quella persona al primo salvataggio.
 * Cosi' invece si vede, e chi guarda decide se correggerla.
 */
export function FitRankingSelect({ value, onChange, disabled, className = '', id }: Props) {
  const fuoriElenco = value.trim() !== '' && !isValidFitRanking(value);

  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="">Seleziona la classifica…</option>

      {fuoriElenco && (
        <option value={value}>{value} (valore non standard)</option>
      )}

      {FIT_RANKING_GROUPS.map((g) => (
        <optgroup key={g.categoria} label={g.categoria}>
          {g.valori.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
