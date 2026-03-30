# Cleopatra — Project Guide

## Project Vision
A premium, high-performance traditional classifieds marketplace. Users can post, browse, and respond to ads across categories. Sellers can pay to "bump" listings to the top for greater visibility.

## Tech Stack
- **Framework**: Next.js 16 (App Router, TypeScript)
- **Auth / DB / Storage**: Supabase
- **UI Components**: Shadcn/UI
- **Payments**: Stripe (listing fees, premium bumps)
- **Icons**: Lucide-React
- **Animations**: Framer Motion
- **Utilities**: clsx, tailwind-merge

## Core Standards
- Mobile-first responsive design (Tailwind breakpoints: `sm` → `md` → `lg`)
- Strict TypeScript — no `any`, all props and API responses typed
- Lucide-React for all icons — no emoji icons in UI
- `cn()` helper (`clsx` + `tailwind-merge`) for all `className` merging — import from `@/lib/utils`
- Server Components by default; `"use client"` only when interactivity or hooks require it
- Supabase Row Level Security (RLS) must be enabled on all tables

## Project Structure
```
/app          — Next.js App Router pages & layouts
/app/api      — API route handlers
/components   — Shared UI components
/lib          — Supabase client, Stripe helpers, utility functions
/hooks        — Custom React hooks
```

## Key Conventions
- Use `app/` directory routing only (no `/pages`)
- Database queries go in `/lib` server-side helpers, not directly in components
- Environment variables prefixed with `NEXT_PUBLIC_` for client-safe vars only
- All monetary amounts stored in pence/cents (integers), displayed formatted in UI

## Social Discovery Vision
A future mode that surfaces listings through a social feed — users follow categories and sellers, see activity in a scrollable timeline, and discover items via engagement signals (saves, views, shares). This mode is toggled independently of the classic classifieds experience, allowing both to coexist and be A/B tested in production.

## Feature Flags
All feature flags live in `lib/features.ts` and are driven by `NEXT_PUBLIC_` environment variables (inlined at build time by Next.js).

| Flag | Env Var | Default | Effect |
|------|---------|---------|--------|
| `USE_SOCIAL_FEED` | `NEXT_PUBLIC_USE_SOCIAL_FEED` | `false` | Swaps the home page from ClassicHome to SocialHome |
| `USE_POSTING_PACKAGES` | `NEXT_PUBLIC_USE_POSTING_PACKAGES` | `false` | Requires post credits to create feed posts (stories remain free) |
| `USE_GEO_FEED` | `NEXT_PUBLIC_USE_GEO_FEED` | `false` | Enables radius-based proximity filtering on explore page |
| `USE_POST_COOLDOWN` | `NEXT_PUBLIC_USE_POST_COOLDOWN` | `false` | Enforces minimum time gap between feed posts (default 6h) |

**Rules:**
- Add new flags to `lib/features.ts` — never read `process.env` directly in components
- Toggling a flag requires a rebuild/redeploy (build-time evaluation)
- Document every flag in this table when added
