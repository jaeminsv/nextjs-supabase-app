// Admin member management page — Server Component wrapper.
// Wraps data-fetching in Suspense as required by cacheComponents mode.

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { MemberManagementClient } from "@/components/member-management-client";
import type { Profile } from "@/lib/types/profile";

/**
 * Inner async component that fetches all members from the database.
 * Must be wrapped in <Suspense> by the parent page component.
 */
async function MemberManagementContent() {
  const supabase = await createClient();

  // Fetch all profiles ordered by creation date (newest first)
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("MemberManagementContent error:", error);
  }

  const profiles = (data as Profile[]) ?? [];

  return <MemberManagementClient profiles={profiles} />;
}

/**
 * Admin member management page shell.
 * Wraps the data-fetching content in Suspense.
 */
export default function MemberManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3 p-4">
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
      }
    >
      <MemberManagementContent />
    </Suspense>
  );
}
