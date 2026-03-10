"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Home, Shield, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tab configuration for the bottom navigation bar.
 * Each tab maps to a top-level route in the (main) route group.
 * Tabs with `adminOnly: true` are only visible to admin users.
 */
interface Tab {
  label: string;
  icon: LucideIcon;
  href: string;
  adminOnly?: boolean;
}

const TABS: Tab[] = [
  { label: "홈", icon: Home, href: "/dashboard" },
  { label: "이벤트", icon: Calendar, href: "/events" },
  { label: "프로필", icon: User, href: "/profile" },
  { label: "회원관리", icon: Shield, href: "/admin/members", adminOnly: true },
];

interface MobileTabBarProps {
  userRole: string;
}

/**
 * Mobile bottom tab bar for primary navigation.
 *
 * Positioned as a regular flex item at the bottom of the (main) layout's
 * flex column — no fixed positioning needed because the app shell
 * (h-dvh flex-col) naturally keeps it at the bottom of the viewport.
 *
 * - Highlights the active tab based on the current pathname
 * - Filters tabs based on user role (e.g., admin-only tabs hidden for members)
 * - Phase 1: userRole is hardcoded as 'member' in the parent layout
 * - Phase 3: userRole will be fetched from the profiles table
 */
export function MobileTabBar({ userRole }: MobileTabBarProps) {
  const pathname = usePathname();

  // Filter tabs based on user role — admin-only tabs hidden for non-admins
  const visibleTabs = TABS.filter(
    (tab) => !tab.adminOnly || userRole === "admin",
  );

  return (
    <nav
      className="z-50 h-16 shrink-0 border-t bg-background"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex h-full items-center justify-around">
        {visibleTabs.map((tab) => {
          // Check if the current path matches this tab's route
          // Special case: /dashboard is the root, others match by prefix
          const isActive =
            tab.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(tab.href);

          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
