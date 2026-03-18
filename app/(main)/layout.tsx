import { Suspense } from "react";
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
  // Fetch the current user's role to show role-based tabs (e.g. admin menu).
  // Uses getClaims() for the user ID (no network call), then queries the profile.
  // Falls back to 'member' if the query fails so the layout always renders.
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let userRole: "member" | "admin" = "member";
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (profile?.role === "admin") {
      userRole = "admin";
    }
  }

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
