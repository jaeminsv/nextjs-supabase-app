import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents is an experimental Next.js 16 feature that requires
  // all uncached data access (cookies, headers, DB calls) to be wrapped
  // in <Suspense> boundaries. This conflicts with Supabase's cookie-based
  // auth which is used pervasively in server components.
  //
  // Disabling until the project adopts "use cache" + cacheLife() patterns
  // for public (unauthenticated) data in a future refactor.
  // cacheComponents: true,
};

export default nextConfig;
