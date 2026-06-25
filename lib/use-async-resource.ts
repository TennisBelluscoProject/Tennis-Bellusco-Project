'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RepoResult } from '@/lib/repositories';

/**
 * Generic async resource hook.
 *
 * Replaces the recurring pattern that was repeated across PlayerView,
 * CoachDashboard, GoalTemplateManager, etc.:
 *
 *     const [data, setData] = useState<T[]>([]);
 *     const [loading, setLoading] = useState(true);
 *     const [tick, setTick] = useState(0);
 *     useEffect(() => {
 *       let cancelled = false;
 *       (async () => {
 *         const { data, error } = await someFetch();
 *         if (!cancelled) { setData(data); setLoading(false); }
 *       })();
 *       return () => { cancelled = true; };
 *     }, [tick, ...]);
 *
 * Usage:
 *
 *     const { data, loading, error, refetch } = useAsyncResource(
 *       () => goalRepo.listByStudent(playerId),
 *       [playerId]
 *     );
 *
 * Notes:
 *  - The fetcher must return a `RepoResult<T>` (success/error envelope).
 *  - Re-runs whenever any dependency in `deps` changes.
 *  - Bails out cleanly if the component unmounts mid-fetch.
 *  - `refetch()` forces a re-run without changing dependencies.
 */
export function useAsyncResource<T>(
  fetcher: () => Promise<RepoResult<T>>,
  deps: ReadonlyArray<unknown>
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Keep a stable ref to the latest fetcher so changing its identity
  // (typical with inline arrow functions) does not retrigger the effect.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcherRef.current().then((res) => {
      if (cancelled) return;
      if (res.error) {
        setError(res.error.message);
        setData(null);
      } else {
        setData(res.data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // We intentionally use the spread deps from the caller; the fetcher ref
    // sidesteps the usual "function identity" foot-gun.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, refetch };
}
