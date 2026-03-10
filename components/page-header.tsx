"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  // The title displayed in the header
  title: string;
  // If provided, back button links here. Otherwise uses router.back()
  backHref?: string;
}

/**
 * Consistent page header with a back navigation button.
 * Used on detail/edit pages to give users a way to go back.
 *
 * - If backHref is provided: clicking back navigates to that URL
 * - If backHref is omitted: clicking back goes to browser history (router.back())
 */
export function PageHeader({ title, backHref }: PageHeaderProps) {
  const router = useRouter();

  return (
    <header className="flex items-center gap-2 border-b px-4 py-3">
      {backHref ? (
        // Navigate to explicit URL when backHref is provided
        <Link href={backHref}>
          <Button variant="ghost" size="icon" aria-label="뒤로가기">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
      ) : (
        // Fall back to browser history when no backHref
        <Button
          variant="ghost"
          size="icon"
          aria-label="뒤로가기"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
