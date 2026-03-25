import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/navigation/app-header";
import { MobileTabBar } from "@/components/navigation/mobile-tab-bar";
import { createClient } from "@/lib/supabase/server";

/**
 * App shell layout for all authenticated (main) routes.
 *
 * Uses the "app shell" pattern: header and tab bar are fixed within a
 * flex column, while only the main content area scrolls.
 *
 *   ┌─────────────────┐
 *   │  AppHeader h-14 │  ← does not scroll
 *   ├─────────────────┤
 *   │                 │
 *   │  main content   │  ← overflow-y-auto (only this scrolls)
 *   │  flex-1         │
 *   │                 │
 *   ├─────────────────┤
 *   │  MobileTabBar   │  ← does not scroll
 *   │  h-16           │
 *   └─────────────────┘
 *
 * Because the entire app is already constrained to max-w-[430px] in
 * the root layout, no fixed positioning is needed here — the header
 * and tab bar stay in place naturally via flex column layout.
 */
export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Defense-in-depth role guard: even if proxy.ts fails to redirect (e.g.,
  // due to a transient DB error), this layout blocks pending/incomplete users
  // from accessing any (main) route (/dashboard, /events, /profile, /admin/*).
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  // Fetch role AND full_name to detect both incomplete onboarding and pending approval.
  // proxy.ts handles unauthenticated users, so userId missing here is an edge case.
  const { data: profile } = userId
    ? await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", userId)
        .single()
    : { data: null };

  // Guard 1: No profile or onboarding not completed (full_name is empty).
  // The DB trigger creates a stub with full_name='' — onboarding sets a real name.
  if (!profile || profile.full_name === "") {
    redirect("/onboarding");
  }

  // Guard 2: Profile exists but admin has not yet approved the user.
  // Only 'member' and 'admin' roles may access the (main) area.
  if (profile.role === "pending") {
    redirect("/pending");
  }

  // Determine the tab bar role: only distinguish admin vs. regular member.
  const userRole: "member" | "admin" =
    profile.role === "admin" ? "admin" : "member";

  return (
    // h-dvh: uses dynamic viewport height to handle mobile browser chrome correctly
    <div className="flex h-dvh flex-col">
      <AppHeader />
      <main className="flex-1 overflow-y-auto">{children}</main>
      {/* Suspense boundary required by cacheComponents mode for Client Components using usePathname */}
      <Suspense fallback={<div className="h-16 border-t" />}>
        <MobileTabBar userRole={userRole} />
      </Suspense>
    </div>
  );
}
