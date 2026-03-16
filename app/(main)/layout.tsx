import { AppHeader } from "@/components/navigation/app-header";
import { MobileTabBar } from "@/components/navigation/mobile-tab-bar";
import { CURRENT_USER } from "@/lib/dummy-data";

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
 *
 * Phase 1: userRole is hardcoded as 'member' (no DB yet).
 * Phase 3 (Task 011): Replace with actual role fetched from profiles table.
 */
export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Phase 2: userRole is read from CURRENT_USER dummy data.
  // TODO (Phase 3): Fetch user role from profiles table via Supabase
  // const supabase = await createClient();
  // const { data } = await supabase.auth.getClaims();
  // const profile = await supabase.from('profiles').select('role').eq('id', data.claims.sub).single();
  // const userRole = profile.data?.role ?? 'member';
  const userRole = CURRENT_USER.role;

  return (
    // h-dvh: uses dynamic viewport height to handle mobile browser chrome correctly
    <div className="flex h-dvh flex-col">
      <AppHeader />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <MobileTabBar userRole={userRole} />
    </div>
  );
}
