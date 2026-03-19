"use client";

/**
 * Error boundary for the (main) route group.
 *
 * Next.js App Router automatically wraps this component around all pages
 * within the (main) group when an unhandled error is thrown during rendering.
 *
 * IMPORTANT: error.tsx must be a Client Component because React error boundaries
 * require lifecycle methods (componentDidCatch) which only work on the client.
 *
 * The `reset` function re-renders the segment from scratch, allowing the user
 * to recover without a full page reload.
 */

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  // The error object thrown during rendering.
  // `digest` is a server-side error hash added by Next.js for server log correlation.
  error: Error & { digest?: string };
  // Calling reset() attempts to re-render the failed segment.
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  // Log the error to the console so developers can trace it in browser DevTools.
  // In production, you'd send this to an error monitoring service (e.g. Sentry).
  useEffect(() => {
    console.error("[Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      {/* Error icon */}
      <AlertCircle className="h-12 w-12 text-destructive" />

      {/* Heading */}
      <h2 className="text-xl font-semibold">문제가 발생했습니다</h2>

      {/* Error detail — shown only in development; hide in production for security */}
      {process.env.NODE_ENV === "development" && error.message && (
        <p className="max-w-sm text-sm text-muted-foreground">
          {error.message}
        </p>
      )}

      {/* Retry button — calls reset() to attempt re-rendering the failed segment */}
      <Button onClick={reset} variant="outline">
        다시 시도
      </Button>
    </div>
  );
}
