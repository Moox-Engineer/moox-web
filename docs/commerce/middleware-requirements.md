# MOOX Commerce Middleware — Requirements

Requirements for the **real middleware** service that will front **Odoo 19**
for the MOOX website. It will be developed in its own repository. The
behavioral contract it must satisfy is [`middleware-api.md`](./middleware-api.md);
this document adds the why, the Odoo mapping, and non-functional demands.
Facts about Odoo 19 come from [`odoo-19-notes.md`](./odoo-19-notes.md).

## 1. Context

```
┌────────────────┐   HTTPS/JSON   ┌──────────────┐   Odoo external API   ┌─────────┐
│  MOOX website  │ ─────────────► │  middleware  │ ────────────────────► │ Odoo 19 │
│  (Next.js      │  bearer token  │  (own repo,  │  JSON-2 + legacy      │ (sale / │
│   backend/)    │                │   no DB)     │  JSON-RPC             │  stock / │
└────────────────┘                └──────────────┘                       │  acct …)│
       ▲                                  ▲                               └─────────┘
       │ browser                           │ gateway webhooks (Pattern B)
```

The middleware is a **stateless translation and protection layer**. It owns no
database of its own; all commerce state lives in Odoo. Its jobs:

1. Expose the clean REST contract in `middleware-api.md` to the backend.
2. Talk Odoo (models, methods, quirks) so nothing else has to.
3. Absorb Odoo's operational limits (no multi-call transactions, rate limits,
   private-method restrictions, no outbound webhooks).

## 2. Transport & authentication

- **REQ-TR-1** — Serve the `middleware-api.md` v1 contract as-is. Breaking
  changes require a `/v2` prefix, never in-place.
- **REQ-TR-2** — Authenticate callers with a bearer service token
  (`Authorization: Bearer …`), one token per consumer, rotatable without
  downtime (accept old + new during a rotation window).
- **REQ-TR-3** — To Odoo: use the **JSON-2 external API**
  (`POST /json/2/<model>/<method>`, bearer API key) as primary transport.
  Encapsulate the **legacy `/jsonrpc`** (`execute_kw`) as a fallback, needed
  because JSON-2 refuses private `_`-prefixed methods (see `odoo-19-notes.md`
  §2) while several commerce internals are private (`product.pricelist
  ._get_products_price`, coupon apply, delivery setters).
- **REQ-TR-4** — Odoo auth via **dedicated bot users** (no password login,
  trimmed ACLs — e.g. a read-mostly catalog bot and an order-writing bot).
  Keys expire after at most 3 months in Odoo 19; rotation must be an
  operational runbook, not a rewrite.
- **REQ-TR-5** — Isolate ALL Odoo transport inside the middleware; the
  backend must never learn which transport, database, or Odoo instance is
  behind it. (The legacy RPC endpoints are scheduled for removal in Odoo 22 /
  Odoo Online 21.1 — keeping them behind this seam makes that migration a
  middleware-internal change.)
- **REQ-TR-6** — Set `X-Odoo-Database` / company context explicitly per
  request; support `context.lang` passthrough (`id_ID` default) so catalog
  reads are translatable without separate endpoints.

## 3. Functional requirements by domain

### Catalog

- **REQ-CAT-1** — Serve products from `product.template` / `product.product`
  (variants map to SKUs) with `product.category` as categories. Map Odoo's
  `is_published` to `status` (`active`/`archived`); support a `coming_soon`
  state via a documented convention (e.g. a tag or `description` marker —
  decide and document in the middleware repo).
- **REQ-CAT-2** — **Never ship binary image fields through the API.** Serve
  image URLs of the form `{odoo_base}/web/image/product.template/{id}/image_1920`
  (and resized variants). The middleware rewrites these to
  publicly-reachable URLs (or proxies them) — the backend/frontend must not
  need Odoo credentials to load a product photo.
- **REQ-CAT-3** — Filtering: category, name/description substring, featured.
  Server-side `search` domains are sufficient in v1; no full-text engine.
  Phase 2 may add an index (Meilisearch etc.) behind the same endpoints.

### Pricing

- **REQ-PR-1** — Prices in IDR, computed **server-side only**. Map to
  `product.pricelist` (+ `_get_products_price` via legacy RPC — REQ-TR-3).
  The contract's prices are tax-inclusive; configure Odoo pricelist/tax
  rounding accordingly.
- **REQ-PR-2** — Order totals must come from a real draft `sale.order`
  (`amount_total`, `amount_by_group`) — not from middleware-side arithmetic —
  so tax logic (PPN via fiscal position, `l10n_id`) stays single-sourced in
  Odoo. The middleware may cache, never recompute.
- **REQ-PR-3** — Single default pricelist in v1; multi-pricelist/B2B pricing
  is Phase 2 (contract extension: `pricelist` request field already reserved
  as optional).

### Inventory

- **REQ-INV-1** — Serve `free_qty` (on-hand − reserved) per SKU, aggregated
  and per-warehouse, from `product.product` computed fields
  (`qty_available`/`free_qty`) or `stock.quant`. Compute with a user that has
  stock read access (`compute_sudo=False` matters — see notes §3).
- **REQ-INV-2** — **Odoo reserves stock only at picking confirmation, not at
  cart/order-draft time.** The middleware must (a) re-validate `free_qty` on
  order create, (b) re-validate + call `action_confirm` atomically-enough at
  confirm (retry with fresh read on failure), and (c) surface `OUT_OF_STOCK`
  with per-SKU detail. Overselling between read and confirm is a known race
  the middleware owns.
- **REQ-INV-3** — No reservation hold API in v1 (Phase 2 candidate: short-TTL
  soft holds via a reserved location).

### Customers

- **REQ-CUS-1** — Upsert `res.partner` by email; address as `type='delivery'`
  child; phone on partner. Never write through the eCommerce public user.
- **REQ-CUS-2** — Guest checkout only in v1. Customer accounts/portal
  (password reset, order history by login) is Phase 2; order lookup in v1 is
  by order id (+email check at the backend layer).

### Orders

- **REQ-ORD-1** — Create `sale.order` with `partner_id`, `pricelist_id`,
  `order_line = [(0,0,{product_id, product_uom_qty})]`; prices/taxes recompute
  server-side. Ignore any client price.
- **REQ-ORD-2** — **Idempotency-Key** (contract-wide) implemented via a
  middleware-side idempotency table or Odoo `ir.config_parameter`-backed
  store keyed by hash(request). Required because retries WILL happen: Odoo
  external calls each commit independently — there is **no multi-call
  transaction boundary** across `partner → order → lines → payment` — so the
  middleware needs both idempotency and compensation (e.g. cancel a created
  draft order if line creation fails).
- **REQ-ORD-3** — Map contract statuses to Odoo: `draft` = draft SO;
  `confirmed` = `action_confirm()`; `cancelled` = `action_cancel()` from
  draft/sent only; `shipped`/`delivered` derived from outgoing picking state;
  invoice state surfaces Phase 2.
- **REQ-ORD-4** — Order events (Phase 2): outbound notifications do **not**
  exist in Odoo Community (see notes §6). v1 polling is fine (backend polls
  `GET /orders/{id}`); Phase 2 adds `GET /events?since=<write_date>` built on
  `write_date` delta scans, or a small custom Odoo module emitting webhooks.

### Payments — the big design decision

Odoo 19's payment flow (`/payment/pay`, providers, webhooks) is web-session
oriented. Two workable patterns; the contract abstracts both (see
`kind: redirect | instructions`).

- **REQ-PAY-1 — Support BOTH patterns behind one initiate endpoint:**
  - **Pattern A (Odoo-owned)**: middleware generates an Odoo payment link
    (`payment.link.wizard` or `/payment/pay` URL) for the confirmed-amount
    order; the customer pays on an Odoo-hosted flow; the provider notifies
    Odoo directly; Odoo confirms the SO. Fits providers with **official Odoo
    19 connectors** — including **Xendit** (official since 17; QRIS, VA,
    e-wallets). Least code, most Odoo-native.
  - **Pattern B (middleware-owned)**: middleware charges the gateway itself
    (e.g. **Midtrans Snap/API** — no official Odoo 19 module exists), handles
    the gateway webhook (`POST /payments/webhook`, signature-verified), then
    records the payment on the Odoo invoice/order via API. More code; the
    middleware owns payment state, refund reconciliation, and PCI-adjacent
    security.
  - Recommendation when the time comes: start Pattern A with Xendit; adopt
    Pattern B only if a gateway without an official connector is
    business-critical.
- **REQ-PAY-2** — Webhook verification (Pattern B): verify gateway signature
  per gateway spec (e.g. Midtrans SHA-512 body+server-key), reject with 400,
  log raw payloads for replay.
- **REQ-PAY-3** — Expiry: instructions-style payments expire
  (`expiresAt`, default 20 min QRIS / 24 h VA per gateway norms); a cron/tick
  inside the middleware marks stale payments `expired` and orders back to
  `draft` or `failed`.

### Indonesian specifics

- **REQ-ID-1** — IDR rounding: rupiah integers, no minor units. Odoo
  currency rounding must be 1 IDR.
- **REQ-ID-2** — PPN via `account.tax` + fiscal positions (`l10n_id` module);
  e-Faktur needs `l10n_id_efaktur_coretax` — Phase 2, but do not build
  anything that fights it (keep invoice creation in Odoo).
- **REQ-ID-3** — Phone/address validation for Indonesian formats at the
  backend layer; middleware trusts its authenticated caller.

## 4. Non-functional requirements

- **REQ-NF-1 — Rate budget.** Odoo Online throttles ~60 req/min (429);
  self-hosted has no limiter but real capacity limits. The middleware must:
  batch reads (`search_read`, ≤100/call), cache catalog (below), and shield
  Odoo from frontend traffic bursts. Expose `RATE_LIMITED` + `Retry-After`
  to the backend when saturating.
- **REQ-NF-2 — Idempotency + compensation** for all multi-step Odoo writes
  (REQ-ORD-2). No exception.
- **REQ-NF-3 — Timeouts & retries.** Per-call timeout ≤10 s; retry only
  idempotent reads (exponential backoff + jitter); never blind-retry writes
  (idempotency keys make retries safe).
- **REQ-NF-4 — Caching.** Catalog GETs: s-maxage ≥60 s, ETag, SWR ≥300 s;
  inventory: max-age ≤15 s (freshness matters more). Cache invalidation via
  TTL only in v1 (no Odoo-side purge hook exists).
- **REQ-NF-5 — Observability.** Structured logs with request id, endpoint,
  Odoo model/method, duration, caller token id. Metrics: latency per Odoo
  method, error rate, cache hit rate. Health endpoint distinguishes
  `mode: odoo` and fails when Odoo RPC fails.
- **REQ-NF-6 — Security.** TLS only; secrets from env/secret manager (never
  in repo); no PII in logs beyond hashed email; the middleware is the ONLY
  service with Odoo credentials.
- **REQ-NF-7 — Deployment.** Stateless (all state in Odoo / its idempotency
  store); horizontally scalable; config via env: `ODOO_BASE_URL`,
  `ODOO_DB`, `ODOO_API_KEY_*`, `SERVICE_TOKENS`, gateway creds (Pattern B).

## 5. Phasing

| Phase | Contents |
|---|---|
| **v1 (this repo's mock parity)** | catalog, pricing, inventory, customers, orders (draft/confirm/cancel), payments initiate/webhook/status — exactly `middleware-api.md` |
| **v2** | delivery rating (`delivery.carrier.rate_shipment`), coupons (`loyalty` via wrapper), returns/RMA (`stock.return.picking`, credit notes), order events feed, accounts/portal, multi-pricelist, search index |
| **Later** | e-Faktur export surfacing, B2B workflows, multi-website/multi-company |

## 6. Out of scope for the middleware

Cart state (lives in the Next.js backend's database — SQLite/Postgres, see
`backend.md`; Odoo's `website_sale` cart is HTTP-session-bound and
deliberately NOT used, see notes §4); product merchandising UI; CMS; anything
the mock already covers without Odoo.
