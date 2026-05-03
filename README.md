# SweetPotatoFry

Property management PWA for Maltese long-lets. Three roles (owner, co-owner, manager).

## Stack

- Next.js 15 App Router on Vercel
- Supabase (Postgres + Auth + RLS)
- Drizzle ORM
- Tailwind CSS + shadcn/ui
- Vercel Blob, Postmark, Web Push (VAPID)

## Local development

```bash
cp .env.example .env.local       # fill in real values when ready
npm install
npm run dev
```

The app boots without external credentials; features that need them
(OAuth, email, push, blob storage) degrade gracefully.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright |
| `npm run db:generate` | Drizzle migrations from schema |
| `npm run db:push` | Apply schema to dev DB |
| `npm run db:seed` | Seed Maltese localities + rebate bands |
| `npm run ci` | typecheck + lint + test |

## Branch

All Phase 1 development happens on `claude/property-management-setup-ITTdj`.
