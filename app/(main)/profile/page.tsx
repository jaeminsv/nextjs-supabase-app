/**
 * Profile page — Server Component wrapper.
 *
 * Fetches the current user's profile from Supabase and passes it to
 * the interactive ProfileClient for view/edit functionality.
 */

import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "@/components/profile-client";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const supabase = await createClient();

  // Get user ID from JWT claims (no network call)
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    redirect("/auth/login");
  }

  // Fetch full profile from the database
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) {
    redirect("/onboarding");
  }

  return <ProfileClient profile={profile} />;
}
