"use client";

/**
 * Error boundary for the event detail page (/events/[id]).
 *
 * Handles unexpected errors thrown during event detail rendering,
 * such as database connection failures or unexpected data shape issues.
 * Note: 404 errors (event not found) are handled separately by not-found.tsx.
 *
 * IMPORTANT: error.tsx must be a Client Component because React error boundaries
 * require lifecycle methods that only work on the client.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  // The error thrown during event detail rendering.
  // `digest` is a server-side hash added by Next.js for log correlation.
  error: Error & { digest?: string };
  // Calling reset() re-renders the event detail segment from scratch.
  reset: () => void;
}

export default function EventDetailError({ error, reset }: ErrorProps) {
  const router = useRouter();

  // Log the error for developer debugging.
  // In production, forward this to an error monitoring service.
  useEffect(() => {
    console.error("[Event Detail Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      {/* Error icon */}
      <AlertCircle className="h-12 w-12 text-destructive" />

      {/* Heading */}
      <h2 className="text-xl font-semibold">이벤트를 불러올 수 없습니다</h2>

      {/* Subtitle */}
      <p className="max-w-sm text-sm text-muted-foreground">
        이벤트 정보를 가져오는 중 오류가 발생했습니다.
      </p>

      {/* Action buttons: retry or go back to events list */}
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          다시 시도
        </Button>
        <Button onClick={() => router.push("/events")} variant="default">
          이벤트 목록으로
        </Button>
      </div>
    </div>
  );
}
