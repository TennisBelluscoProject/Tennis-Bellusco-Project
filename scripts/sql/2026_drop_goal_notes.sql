-- Rimozione tabella goal_notes (mai utilizzata: 0 righe in produzione,
-- nessuna query nel codice, solo dichiarata nei tipi TS).

drop table if exists public.goal_notes cascade;
