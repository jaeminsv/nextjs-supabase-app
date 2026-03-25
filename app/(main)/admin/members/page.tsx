// Admin member management page — Server Component wrapper.
// Wraps data-fetching in Suspense as required by cacheComponents mode.

// Force dynamic rendering — this page reads cookies() for Supabase auth.
// Without this, Next.js attempts static pre-rendering at build time,
// which throws a "Dynamic server usage" error.
export const dynamic = "force-dynamic";

import { Suspense } from "react";
// Renamed to avoid conflict with the `dynamic` route config export above.
import nextDynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/profile";

// Dynamic import splits MemberManagementClient into its own JS chunk.
// This page is admin-only, so splitting it reduces the bundle for member page loads.
const MemberManagementClient = nextDynamic(() =>
  import("@/components/member-management-client").then(
    (m) => m.MemberManagementClient,
  ),
);

/**
 * Inner async component that fetches all members from the database.
 * Must be wrapped in <Suspense> by the parent page component.
 */
async function MemberManagementContent() {
  const supabase = await createClient();

  // Fetch profiles with only the columns needed for the member management UI.
  // Excludes KAIST major names, venmo/zelle handles, and timestamps not shown in the UI.
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, display_name, email, role, phone, company, job_title, kaist_bs_year, kaist_ms_year, kaist_phd_year, created_at",
    )
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
