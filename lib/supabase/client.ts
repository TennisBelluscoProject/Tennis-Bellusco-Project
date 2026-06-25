import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../database.types';

/**
 * Browser-side Supabase client.
 *
 * Returns a fully typed client: every `.from('table').select(...)` call now
 * infers the correct `Row` / `Insert` / `Update` shape from `Database`, so
 * the `as Profile[]` casts scattered around the codebase are no longer
 * type-required (kept where convenient for narrowing joins).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
