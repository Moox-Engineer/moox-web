<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MOOX Commerce Backend

Next.js commerce BFF + storefront for the MOOX website. Talks to the commerce
middleware only (never Odoo directly). Contract: `../docs/commerce/middleware-api.md`.
Architecture doc: `../docs/commerce/backend.md` — read it before touching
`lib/db.ts` or `lib/cart.ts`.

- `npm run dev` → :3001 · `npm run smoke` → end-to-end check (spawns the mock
  from `../mock-middleware` itself, resets its data, uses a throwaway SQLite
  file) · `npx tsc --noEmit` for types.
- Dev expects the mock middleware on :7070 (`cd ../mock-middleware && npm start`).
- Database: SQLite (`data/moox.db`) in dev, Postgres via `DATABASE_URL` in
  production — one portable schema; keep DDL dialect-agnostic (TEXT PKs,
  ISO timestamps, no autoincrement).
- API routes under `app/api/v1/` use the shared error envelope; prices and
  stock are always live middleware reads, never stored locally.
- All copy is Indonesian (`lang="id"`), matching the marketing site.
