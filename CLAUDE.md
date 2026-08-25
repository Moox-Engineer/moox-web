# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

moox-web is a multi-app workspace — one repo, four deployable/context units:

| Folder | What | Deploy |
|---|---|---|
| root | Vanilla-JS + Vite marketing site (Indonesian, `lang="id"`) | Netlify (static, `dist/`) |
| `internal-docs/` | Password-gated internal docs site — self-contained, split out later | Second Netlify site, base dir `internal-docs` |
| `backend/` | Next.js commerce backend + first storefront pages (TypeScript) | TBD (Netlify Next runtime or Vercel) |
| `mock-middleware/` | CSV-backed mock of the commerce middleware contract | never deployed — dev only |
| `docs/commerce/` | Middleware contract, requirements, Odoo 19 research | — |

## Commands

```bash
# marketing site (root)
npm run dev          # Vite on :3000
npm run build        # → dist/

# mock middleware
cd mock-middleware && npm start            # :7070, token dev-mock-token

# commerce backend + storefront
cd backend && npm run dev                  # Next on :3001
cd backend && npm run smoke                # end-to-end: spawns both, asserts full flow
cd backend && npx tsc --noEmit             # types
cd backend && npm run lint                 # eslint

# internal docs
cd internal-docs && npm run sync-docs      # regenerate public/ from manifest (needs MOOX_DOCS_ROOT)
```

No test runner for the marketing site; the backend's check is `npm run smoke`.

## Marketing site (root)

Vanilla JavaScript — no framework, no TypeScript. Three Vite HTML entries
(declared in `vite.config.js`): `/` (`index.html` → `src/main.js`),
`/axina` (scroll-driven canvas hero scrubbing 85 GIF frames from
`public/images/axina-frames/`), `/newhome` (redesign draft with its own
design system + waitlist). `cssCodeSplit: true` is load-bearing — `/newhome`'s
global CSS must not leak into other pages' bundles.

Modules in `src/modules/` each export one `init*()`, DOM-guarded no-ops, so
any page can import any module. Netlify Forms power the collaborate form and
the `/newhome` waitlist — the only network calls the static site makes.

## internal-docs/

Serves from site root (not `/internal-doc`); old URLs redirect via
`netlify.toml`. The gate is a Netlify Edge Function
(`internal-docs/netlify/edge-functions/internal-doc-auth.js`): SHA-256 cookie,
12h, `INTERNAL_DOC_PASSWORD` env var (must be set on the second Netlify site —
it falls back to a default otherwise), `/logout` clears it. Generated output
is committed (`public/`); do not hand-edit `public/index.html` — change
`scripts/internal-docs-manifest.mjs` and re-run `sync-docs`. Source documents
live outside the repo (`MOOX_DOCS_ROOT`; the default path is the docs owner's
macOS machine). The sync script fails loudly on manifest entries whose source
files disappeared — intended, to catch renames.

**Netlify setup still pending**: create the second site from this repo (base
directory `internal-docs`), set `INTERNAL_DOC_PASSWORD`, and replace the
placeholder redirect URL in the root `netlify.toml`.

## Commerce stack (backend/ + mock-middleware/ + docs/commerce/)

Architecture: **site → Next.js backend (BFF) → middleware → Odoo 19**. The
middleware is the only service that ever talks Odoo. Full docs:

- `docs/commerce/middleware-api.md` — the wire contract (backend consumes,
  mock + future real middleware implement)
- `docs/commerce/middleware-requirements.md` — REQs for the real middleware
- `docs/commerce/odoo-19-notes.md` — Odoo 19 external-API research
- `docs/commerce/backend.md` — backend architecture + database design

Backend owns what the middleware doesn't: cart state and guest order access,
in its own database — **SQLite in dev, Postgres in production** (`DATABASE_URL`
selects; DDL is portable, see `lib/db.ts`). Prices/stock/orders are always
live middleware reads, never stored backend-side. Cart cookie holds a signed
cart ID only. Checkout sends an `Idempotency-Key` derived from
cart+email+items so retries replay safely against the middleware.

Dev ports: Vite 3000 (also serves product images to the backend via
`NEXT_PUBLIC_ASSETS_BASE`), backend 3001, mock 7071 under smoke test.

## Conventions

- Root marketing site: plain JS, BEM-ish CSS, no build-time env vars.
- Backend: TypeScript, App Router route handlers under `app/api/v1/`,
  Kysely queries in `lib/`, error envelope `{error:{code,message,retryable}}`
  everywhere (same shape as the middleware).
- Commit style: imperative one-liners. Trunk-based on `main`.
