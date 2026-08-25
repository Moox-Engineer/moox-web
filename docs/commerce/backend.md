# Commerce Backend (`backend/`) — Architecture Notes

Next.js (App Router, TypeScript) — BFF for the site's commerce features and
the first step of the storefront migration (`/products` pages render from it).
It talks ONLY to the middleware (contract: `middleware-api.md`); it never
touches Odoo directly.

## What the backend owns vs. the middleware

| Concern | Owner | Where |
|---|---|---|
| Cart state | **backend DB** (`carts`, `cart_items`) | cookie holds a signed cart ID only |
| Guest order access | **backend DB** (`orders`: middleware order ID ↔ email) | `GET /api/v1/orders/{id}?email=` |
| Product data, prices, stock, orders, payments | middleware → Odoo 19 | never cached-stored, always live reads |
| Storefront rendering (`/products`) | backend | server components + `revalidate` caching |

Anything the middleware/Odoo does not cover lives in the backend database —
grow the schema there (e.g. waitlist, accounts) rather than widening the
middleware contract.

## Database: SQLite in dev, Postgres in prod

`lib/db.ts` picks the dialect by environment: `DATABASE_URL` set → Postgres
(`pg` Pool); unset → SQLite file (`data/moox.db`, `SQLITE_PATH` to override).
One schema serves both because the DDL is deliberately portable:

- TEXT primary keys, generated in app code (`randomUUID()`) — sidesteps the
  SQLite/Postgres autoincrement divergence entirely
- ISO-8601 TEXT timestamps; INTEGER 0/1 booleans; no dialect-specific types
- `CREATE TABLE IF NOT EXISTS` idempotent bootstrap (`ensureSchema()`) — no
  migration tooling until the schema actually evolves a second time

Kysely (query builder) was chosen over Drizzle/Prisma precisely because one
set of types + queries runs on both dialects — the ORM alternatives require
duplicated per-dialect schemas.

## Flows

- **Cart**: browser cookie (HttpOnly, signed `cartId.hmac`) → `carts`/`cart_items`
  rows; `GET /api/v1/cart` enriches live from middleware (price/name/stock);
  `PUT /api/v1/cart` validates SKUs against the middleware then replaces
  items in one transaction.
- **Checkout**: reads cart server-side (never trusts a client cart), fresh
  stock check, `POST /orders` (Idempotency-Key = hash(cart+email+items) so
  retries replay safely), records the local `orders` row, converts the cart,
  optionally initiates payment. Payment confirmation arrives at the
  middleware's gateway webhook (Pattern B) or Odoo (Pattern A) — the backend
  polls order status on demand.
- **Order lookup**: `?email=` must match the local row (case-insensitive);
  unknown/mismatched → 404, so order IDs are not probeable.

## Dev workflow

```bash
# terminal 1 — mock middleware
cd mock-middleware && npm start            # :7070
# terminal 2 — backend + storefront
cd backend && npm run dev                 # :3001 (Vite site stays :3000)
# end-to-end check (spawns both itself, resets mock data)
cd backend && npm run smoke
```

Env: see `backend/.env.example`. The mock's default token/secret match the
backend defaults, so plain `npm run dev` works with zero configuration.

## Deployment (future, when real middleware exists)

Separate deploy unit (Netlify Next runtime or Vercel) from the static site;
set `DATABASE_URL` (Postgres), `MIDDLEWARE_BASE_URL`/`MIDDLEWARE_API_TOKEN`,
`CART_COOKIE_SECRET`, `NEXT_PUBLIC_ASSETS_BASE`. The static site calls this
backend's API (same-origin proxy or CORS allowlist — decide at wiring time).
