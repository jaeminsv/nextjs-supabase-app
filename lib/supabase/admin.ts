/**
 * Supabase Admin client — SERVER SIDE ONLY.
 *
 * Uses the service_role key which bypasses Row Level Security (RLS).
 * This client can call auth.admin.* APIs (e.g. deleteUser) that are not
 * available to the regular anon/publishable key client.
 *
 * IMPORTANT: Never import this file in Client Components or expose the
 * service_role key to the browser. The SUPABASE_SERVICE_ROLE_KEY env var
 * intentionally has no NEXT_PUBLIC_ prefix so Next.js never bundles it
 * into the client-side JavaScript.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Creates a new Supabase client with service_role privileges.
 *
 * Unlike the regular server client (server.ts), this client:
 * - Does NOT need cookies (admin operations are not user-session-scoped)
 * - Bypasses RLS policies entirely
 * - Can call auth.admin.* APIs
 *
 * Always create a new instance per request — do not store in a global variable.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin environment variables. " +
        "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      // Disable automatic token refresh — admin client uses a static service key,
      // not a user session that can expire and refresh.
      autoRefreshToken: false,
      // Do not persist the service_role session to localStorage or cookies.
      persistSession: false,
    },
  });
}
