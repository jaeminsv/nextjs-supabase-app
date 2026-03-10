import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Root page — redirects based on authentication status.
 *
 * Authenticated users go to /dashboard (the main app home).
 * Unauthenticated users go to /auth/login.
 */
export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/dashboard");
  }

  redirect("/auth/login");
}
