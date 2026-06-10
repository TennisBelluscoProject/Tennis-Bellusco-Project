/**
 * ╭──────────────────────────────────────────────────────────────────────╮
 * │  REPOSITORY ENTRY POINT                                              │
 * ╰──────────────────────────────────────────────────────────────────────╯
 *
 * Single import surface for consumers:
 *
 *     import { goalRepo, matchRepo, profileRepo, templateRepo } from
 *       '@/lib/repositories';
 *
 * The default instances are wired to the browser Supabase client, so they
 * work out of the box from any 'use client' component. For Server
 * Components / Route Handlers, build a server-bound instance:
 *
 *     import { createClient } from '@/lib/supabase/server';
 *     import { SupabaseGoalRepository } from '@/lib/repositories';
 *
 *     const supabase = await createClient();
 *     const goals = new SupabaseGoalRepository(supabase);
 */

import { supabase } from '../supabase';
import { SupabaseGoalRepository } from './goal.repository';
import { SupabaseMatchRepository } from './match.repository';
import { SupabaseProfileRepository } from './profile.repository';
import { SupabaseGoalTemplateRepository } from './goal-template.repository';

// Re-export contracts so consumers can import interface + instance from
// the same module.
export type {
  IGoalRepository,
  IMatchRepository,
  IProfileRepository,
  IGoalTemplateRepository,
  RepoResult,
  RepoError,
} from './types';

// Re-export classes too, in case someone needs a non-default instance
// (e.g. for Server Components with a server-bound client).
export { SupabaseGoalRepository } from './goal.repository';
export { SupabaseMatchRepository } from './match.repository';
export { SupabaseProfileRepository } from './profile.repository';
export { SupabaseGoalTemplateRepository } from './goal-template.repository';

// ─── Default browser-bound instances ───────────────────────────────────────
export const goalRepo = new SupabaseGoalRepository(supabase);
export const matchRepo = new SupabaseMatchRepository(supabase);
export const profileRepo = new SupabaseProfileRepository(supabase);
export const templateRepo = new SupabaseGoalTemplateRepository(supabase);
