// Re-export the browser client as 'supabase' for backward compatibility
// All client-side components use this import
import { createClient } from './supabase/client';

export const supabase = createClient();
