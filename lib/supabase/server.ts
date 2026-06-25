import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '../database.types';

/**
 * Server-side Supabase client (Server Components, Route Handlers, Server
 * Actions).
 *
 * Follows the official @supabase/ssr contract for Next.js 16:
 *   - uses ONLY `getAll` / `setAll` (never `get` / `set` / `remove`)
 *   - the `setAll` try/catch swallows the "called from a Server Component"
 *     error: in that context cookie writes are not allowed but our proxy
 *     refreshes them, so it's safe to ignore.
 *
 * Reference: https://supabase.com/docs/guides/auth/server-side/creating-a-client
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll was called from a Server Component. Safe to ignore —
            // the proxy refreshes user sessions on every request.
          }
        },
      },
    }
  );
}
