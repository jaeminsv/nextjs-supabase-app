# Deployment Guide

KAIST Silicon Valley Alumni Association Event Management App — Production Deployment Guide.

**Production URL:** `https://nextjs-supabase-app-six.vercel.app`

---

## Prerequisites

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase`)
- [Vercel CLI](https://vercel.com/docs/cli) (`npm install -g vercel`)
- Vercel account
- Supabase account with a production project
- Google Cloud Console project with OAuth 2.0 credentials

---

## Environment Variables

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable                               | Description                                           | Visibility                       |
| -------------------------------------- | ----------------------------------------------------- | -------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL (e.g. `https://xxx.supabase.co`) | Public (client-safe)             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key                         | Public (client-safe)             |
| `SUPABASE_SERVICE_ROLE_KEY`            | Supabase service role key — **server-only**           | Private (never expose to client) |

> **Warning:** Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`. It bypasses all RLS policies.

---

## Supabase Setup

### 1. Link Local CLI to Production Project

```bash
npx supabase login
npx supabase link --project-ref <YOUR_PROJECT_REF>
```

### 2. Apply Database Migrations

```bash
npx supabase db push
```

This applies all files in `supabase/migrations/` in chronological order:

- `20260318205341_init_schema.sql` — Full schema: 5 tables, enums, triggers, RLS policies
- `20260318230000_fix_event_organizers_rls.sql` — RLS fix for event_organizers

### 3. Verify Tables and RLS

Run in Supabase Dashboard → SQL Editor:

```sql
-- Verify all tables have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- Expected: profiles, events, event_organizers, rsvps, payments — all with rowsecurity = true
```

### 4. Configure Auth URLs

In Supabase Dashboard → Authentication → URL Configuration:

```
Site URL:        https://nextjs-supabase-app-six.vercel.app
Redirect URLs:   https://nextjs-supabase-app-six.vercel.app/auth/callback
                 https://nextjs-supabase-app-six.vercel.app/auth/confirm
```

### 5. Configure Google OAuth

In Supabase Dashboard → Authentication → Providers → Google:

- Enable Google provider
- Add Client ID and Client Secret from Google Cloud Console

In Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client:

- Add Authorized Redirect URI: `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`

---

## Vercel Deployment

### First-time Setup

```bash
# Install CLI and authenticate
npm install -g vercel
vercel login

# Link project (run from project root)
vercel link

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Deploy to production
vercel --prod
```

### Subsequent Deployments

```bash
vercel --prod
```

Or push to the connected Git branch for automatic deployment.

### Verify Build Locally First

```bash
npm run check-all   # lint + typecheck + format check
npm run build       # production build test
```

---

## Initial Admin Setup

After the first deployment, you need to promote the first user to admin:

### Option A: SQL Script (Supabase Dashboard)

1. Log in to the app via Google OAuth at the production URL
2. Go to Supabase Dashboard → Authentication → Users, copy your User UID
3. Open `supabase/seed.sql`, replace `<AUTH_USER_UUID>` with your UUID
4. Run the script in Supabase Dashboard → SQL Editor

### Option B: TypeScript Script

```bash
# Set environment variables and run
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
npx tsx scripts/set-admin.ts your-email@example.com
```

See `scripts/set-admin.ts` for full usage details.

---

## Monitoring

| Tool                  | Access                                | Purpose                                  |
| --------------------- | ------------------------------------- | ---------------------------------------- |
| Vercel Analytics      | vercel.com → Project → Analytics      | Page views, unique visitors              |
| Vercel Speed Insights | vercel.com → Project → Speed Insights | Real User Monitoring (Core Web Vitals)   |
| Vercel Logs           | vercel.com → Project → Logs           | Server-side errors, function execution   |
| Supabase Logs         | supabase.com → Project → Logs         | Database queries, auth events, API calls |

Both `@vercel/analytics` and `@vercel/speed-insights` are installed and configured in `app/layout.tsx`. Data appears in the Vercel dashboard automatically after deployment.

---

## Lighthouse Audit Results

Audited: `https://nextjs-supabase-app-six.vercel.app/auth/login`
Tool: Lighthouse CLI 13.0.3
Date: 2026-03-19

| Category       | Score   | Target  |
| -------------- | ------- | ------- |
| Performance    | **98**  | ≥ 90 ✅ |
| Accessibility  | **98**  | ≥ 90 ✅ |
| Best Practices | **100** | ≥ 90 ✅ |
| SEO            | **91**  | ≥ 90 ✅ |

### Core Web Vitals

| Metric                         | Value | Rating    |
| ------------------------------ | ----- | --------- |
| First Contentful Paint (FCP)   | 1.4 s | Good      |
| Largest Contentful Paint (LCP) | 2.3 s | Good      |
| Total Blocking Time (TBT)      | 10 ms | Excellent |
| Cumulative Layout Shift (CLS)  | 0     | Excellent |
| Speed Index                    | 1.4 s | Good      |

---

## Common Issues

| Issue                               | Fix                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Auth redirect loop in production    | Check Supabase Auth → Site URL matches Vercel domain                    |
| RLS blocking all queries            | Verify user has correct `role` in profiles table; check RLS policies    |
| Build fails on Vercel               | Run `npm run build` locally first to catch errors                       |
| Google OAuth 400 error              | Add production callback URL to Google Cloud Console and Supabase Auth   |
| New user not landing on onboarding  | Verify `handle_new_auth_user` trigger exists in Supabase DB → Functions |
| `SUPABASE_SERVICE_ROLE_KEY` exposed | Never prefix with `NEXT_PUBLIC_` — keep server-only                     |

---

## Architecture Notes

- **`proxy.ts`** (project root) replaces `middleware.ts` — required for Next.js 16. Never create `middleware.ts`.
- **3-layer Supabase client**: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server), `lib/supabase/proxy.ts` (session refresh only)
- **Mobile-first**: App is constrained to `max-w-[430px]` centered on desktop. No responsive breakpoints needed for most features.
