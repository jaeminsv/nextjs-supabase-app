/**
 * Profile page — Server Component wrapper.
 *
 * Fetches the current user's profile from Supabase and passes it to
 * the interactive ProfileClient for view/edit functionality.
 *
 * Wrapped in Suspense to show a skeleton UI while data is being fetched,
 * consistent with the pattern used in dashboard, events, and manage pages.
 */

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Dynamic import splits ProfileClient into its own JS chunk.
// The profile form contains react-hook-form and zod which are heavy dependencies;
// splitting them out reduces the initial bundle for other pages.
const ProfileClient = dynamic(() =>
  import("@/components/profile-client").then((m) => m.ProfileClient),
);

/**
 * Inner async component that fetches the user's profile from Supabase.
 * Must be wrapped in <Suspense> by the parent page component.
 */
async function ProfileContent() {
  const supabase = await createClient();

  // Read the current user's ID from the JWT cookie without a network call.
  // getClaims() is preferred over getUser() to avoid Auth API rate limits (429 errors).
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    redirect("/auth/login");
  }

  // Fetch full profile from the database — all fields needed for the edit form
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

/**
 * Profile page shell.
 * Wraps the data-fetching content in Suspense as required by cacheComponents mode.
 */
export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        // Skeleton UI that mirrors the profile page layout while data loads
        <div className="space-y-6 p-4">
          {/* Profile header skeleton */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            </div>
          </div>
          {/* Personal info section skeleton */}
          <div className="space-y-3">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
          {/* KAIST info section skeleton */}
          <div className="space-y-3">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
          {/* Work info section skeleton */}
          <div className="space-y-3">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
