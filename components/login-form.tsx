"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoogleIcon } from "@/components/icons/google";
import { useState } from "react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  // Only keep error state — email/password login is removed in favor of Google-only OAuth
  const [error, setError] = useState<string | null>(null);

  /**
   * Initiates Google OAuth login flow.
   *
   * `signInWithOAuth` redirects the user to Google's login page.
   * After authentication, Google sends the user back to our `/auth/callback` route
   * via Supabase's auth server.
   *
   * The `redirectTo` option tells Supabase where to send the user
   * after the OAuth flow completes (our callback route).
   */
  const handleGoogleLogin = async () => {
    const supabase = createClient();
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // After Google auth, Supabase redirects to our callback route
        // which exchanges the code for a session
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          {/* KAIST Silicon Valley Alumni Association branding */}
          <CardTitle className="text-2xl">KAIST 실리콘밸리 동문회</CardTitle>
          <CardDescription>Google 계정으로 로그인하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Show OAuth error message if login fails */}
            {error && <p className="text-sm text-destructive">{error}</p>}

            {/* Google OAuth login button — the only supported login method */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
            >
              <GoogleIcon className="size-5" />
              Google로 로그인
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
