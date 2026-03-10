/**
 * App-level top header bar.
 *
 * Positioned as a regular flex item within the (main) layout's flex column,
 * so it naturally stays at the top without needing fixed positioning.
 * The app shell container (h-dvh flex-col) keeps it stationary while
 * the content area below it scrolls independently.
 *
 * Phase 3: Add user avatar / notification bell as right-side actions.
 */
export function AppHeader() {
  return (
    <header className="z-50 h-14 shrink-0 border-b bg-background">
      <div className="flex h-full items-center justify-between px-4">
        {/* App name / branding */}
        <span className="text-base font-bold tracking-tight">KAIST SV</span>

        {/* Right-side actions — placeholder for Phase 3 (notification, avatar) */}
        <div className="flex items-center gap-2">{/* TODO: add icons */}</div>
      </div>
    </header>
  );
}
