import type { PostgrestError } from '@supabase/supabase-js';
import type { RepoError, RepoResult } from './types';

/**
 * Maps a Supabase / PostgREST error to our internal `RepoError`.
 * Kept tiny on purpose: callers only need `message` and `code`.
 */
export function toRepoError(err: PostgrestError | Error | unknown): RepoError {
  if (err && typeof err === 'object' && 'message' in err) {
    const e = err as PostgrestError;
    return {
      message: e.message ?? 'Unknown error',
      code: e.code,
    };
  }
  return { message: 'Unknown error' };
}

export function ok<T>(data: T): RepoResult<T> {
  return { data, error: null };
}

export function fail<T>(err: unknown): RepoResult<T> {
  return { data: null, error: toRepoError(err) };
}
