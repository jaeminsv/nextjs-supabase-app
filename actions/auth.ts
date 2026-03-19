"use server";

/**
 * Server Actions for authentication.
 *
 * signOut is called via a <form action={signOut}> from the client, so
 * redirect() works correctly here — it is NOT inside a try-catch block.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Signs the current user out and redirects to the login page.
 *
 * How it works:
 *   1. Creates a fresh Supabase server client (reads cookies from the request)
 *   2. Calls supabase.auth.signOut() to clear the session cookie
 *   3. Redirects to /auth/login so the user can log back in
 *
 * Usage in a Client Component:
 *   <form action={signOut}>
 *     <button type="submit">로그아웃</button>
 *   </form>
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
