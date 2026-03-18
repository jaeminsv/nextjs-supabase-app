import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip proxy check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const pathname = request.nextUrl.pathname;

  // --- Route classification ---
  // Public routes: accessible without authentication
  const isAuthRoute = pathname.startsWith("/auth");
  const isRootRoute = pathname === "/";
  const isPublicRoute = isAuthRoute || isRootRoute;

  // Unauthenticated user trying to access a protected route → redirect to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // Authenticated user visiting auth pages (login, sign-up) → redirect to dashboard
  // Exception: /auth/callback and /auth/confirm must remain accessible for OAuth flow
  if (
    user &&
    isAuthRoute &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/auth/confirm")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // --- Role-based routing (Task 011) ---
  // For authenticated users, query the profiles table to determine their role
  // and redirect them to the appropriate page based on their onboarding/approval status.
  if (user) {
    // Fetch only the minimum columns needed for routing decisions
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.sub)
      .single();

    // Use a typed string variable to safely compare role values
    const role = profile?.role as string | undefined;

    // 1. Onboarding check: profile missing or full_name is empty string.
    //    handle_new_auth_user trigger creates a stub profile with full_name=''
    //    on OAuth sign-in, so we use full_name to detect incomplete onboarding.
    if ((!profile || profile.full_name === "") && pathname !== "/onboarding") {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // 2. Pending users: can only access /pending (awaiting admin approval)
    if (role === "pending" && pathname !== "/pending") {
      const url = request.nextUrl.clone();
      url.pathname = "/pending";
      return NextResponse.redirect(url);
    }

    // 3. Approved users (member/admin): should not be able to access /pending or /onboarding
    if (
      role !== "pending" &&
      (pathname === "/pending" || pathname === "/onboarding")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // 4. Admin-only routes (/admin/*): non-admin users are redirected to dashboard
    if (pathname.startsWith("/admin") && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
