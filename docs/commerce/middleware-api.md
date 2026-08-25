# MOOX Commerce Middleware — API Contract (v1)

This is the contract between the **Next.js commerce backend** (`backend/`, this
repo) and the **commerce middleware** (a separate service, developed later in
its own repo, fronting Odoo 19). A CSV-backed **mock implementation** lives in
`mock-middleware/` in this repo and follows this document exactly, so the
backend can be built and verified before the real middleware exists.

- `middleware-requirements.md` — what the real middleware must do and why
- `odoo-19-notes.md` — research notes on Odoo 19 external APIs
- this file — the wire contract both sides code against

Everything is JSON over HTTPS. The mock speaks plain HTTP on `localhost:7070`.

## Conventions

**Base URL** — configurable; the backend reads `MIDDLEWARE_BASE_URL`.

**Auth** — every request carries a service token:

```
Authorization: Bearer <MIDDLEWARE_API_TOKEN>
```

401 `UNAUTHORIZED` otherwise. In the real system this token is internal
(backend ↔ middleware); the middleware in turn authenticates to Odoo with its
own Odoo API keys. Never expose either token to the browser.

**Idempotency** — every `POST` accepts an `Idempotency-Key` header. Replaying
a request with a key already used returns the original response with
`X-Idempotent-Replay: true`. The backend MUST send keys on order/customer/payment
creation (Odoo has no multi-call transactions — see requirements doc — so
retries will happen and must be safe).

**Errors** — non-2xx responses use one envelope:

```json
{
  "error": {
    "code": "OUT_OF_STOCK",
    "message": "human readable",
    "retryable": false,
    "details": [{ "sku": "AXINA-BLK", "requested": 2, "freeQty": 1 }]
  }
}
```

Codes: `UNAUTHORIZED`, `VALIDATION`, `NOT_FOUND`, `CONFLICT` (state change on
wrong status), `OUT_OF_STOCK`, `RATE_LIMITED` (retryable, honors Retry-After),
`INTERNAL` (retryable). Unknown codes must be treated as `INTERNAL`.

**Pagination** — list endpoints take `page` (1-based) and `perPage`
(default 20, max 100) and return `total`.

**Money** — amounts are integer minor units (IDR has none, so plain rupiah
integers) plus an ISO-4217 `currency`. Catalog prices are **tax-inclusive**
(PPN); order totals carry `taxIncluded: true` and the extracted tax amount.

**Caching** — catalog GETs send `Cache-Control` + `ETag`; consumers should
revalidate (`If-None-Match`) and cache aggressively (see REQ-NF-4).

## Endpoints

### `GET /health`

```json
{ "status": "ok", "version": "v1", "mode": "mock" }
```

`mode` is `"mock"` or `"odoo"` — lets the backend expose which stack it is
talking to.

### `GET /catalog/categories`

```json
{ "categories": [
  { "slug": "smart-glasses", "name": "Smart Glasses", "parent": null, "count": 4 }
] }
```

### `GET /catalog/products`

Query: `category` (slug), `q` (name/description substring), `featured`
(`true`), `skus` (comma-separated — used by consumers to enrich carts),
`page`, `perPage`.

```json
{
  "items": [
    {
      "sku": "AKASA-01",
      "slug": "moo-akasa",
      "name": "MOO Akasa",
      "categorySlug": "smart-glasses",
      "price": { "amount": 2999000, "currency": "IDR" },
      "compareAt": { "amount": 3499000, "currency": "IDR" },
      "status": "active",
      "featured": true,
      "image": "/images/akasa-1.jpg"
    }
  ],
  "page": 1, "perPage": 20, "total": 4
}
```

`status`: `active` | `coming_soon` | `archived`. `compareAt` optional.
`image` is a path (not absolute URL) — the consumer prefixes its asset base.

### `GET /catalog/products/{slug}`

Detail adds description, attributes, and current availability:

```json
{
  "product": {
    "sku": "AKASA-01",
    "slug": "moo-akasa",
    "name": "MOO Akasa",
    "categorySlug": "smart-glasses",
    "price": { "amount": 2999000, "currency": "IDR" },
    "compareAt": null,
    "status": "active",
    "featured": true,
    "image": "/images/akasa-1.jpg",
    "images": ["/images/akasa-1.jpg", "/images/akasa-3.jpg"],
    "descriptionShort": "…",
    "descriptionLong": "…",
    "attributes": { "warna": ["Obsidian", "Moonstone"] },
    "stock": { "freeQty": 12 }
  }
}
```

### `GET /inventory?skus=AKASA-01,AXINA-BLK`

```json
{ "items": [
  {
    "sku": "AKASA-01",
    "freeQty": 12,
    "warehouses": [
      { "code": "JKT", "qtyOnHand": 15, "qtyReserved": 3, "freeQty": 12 }
    ]
  }
] }
```

`freeQty` (top level) = sum across warehouses = on-hand minus reserved. This
is a point-in-time read; nothing is held for the caller (see REQ-INV-2).

### `POST /customers`

Upsert by email (real middleware: `res.partner` search-then-create).

```json
// request
{
  "name": "Siti Rahma",
  "email": "siti@example.com",
  "phone": "+62812…",
  "address": {
    "line1": "Jl. …", "line2": "", "city": "Jakarta Selatan",
    "province": "DKI Jakarta", "postalCode": "12190", "country": "ID"
  }
}
// response 200
{ "customer": { "id": "cus_000123", "name": "Siti Rahma", "email": "siti@example.com" } }
```

### `POST /orders`

Creates a **draft** order. Prices are computed server-side from the item SKUs
— any client-supplied price is ignored. Validates current stock at creation
time (`OUT_OF_STOCK` on failure).

```json
// request
{
  "customerId": "cus_000123",        // optional if customer object given
  "customer": { …same shape as POST /customers… },
  "items": [{ "sku": "AKASA-01", "qty": 1 }],
  "currency": "IDR"
}
// response 201
{
  "order": {
    "id": "ord_000001",
    "number": "MOOX-000001",
    "status": "draft",
    "items": [
      { "sku": "AKASA-01", "name": "MOO Akasa", "qty": 1,
        "unitPrice": { "amount": 2999000, "currency": "IDR" },
        "lineTotal": { "amount": 2999000, "currency": "IDR" } }
    ],
    "totals": {
      "subtotal": { "amount": 2677679, "currency": "IDR" },
      "tax": { "amount": 321321, "currency": "IDR" },
      "shipping": { "amount": 0, "currency": "IDR" },
      "grandTotal": { "amount": 2999000, "currency": "IDR" },
      "taxIncluded": true
    },
    "createdAt": "2026-08-25T02:00:00.000Z"
  }
}
```

### `GET /orders/{id}`

Returns the order object above plus payment state once initiated:

```json
{ "order": { …, "status": "confirmed",
  "payment": { "id": "pay_…", "method": "qris", "status": "paid", "paidAt": "…" } } }
```

Statuses: `draft` → `payment_pending` → `confirmed` → `shipped` → `delivered`;
`cancelled` from any unpaid state; `failed` when payment failed terminally.

### `POST /orders/{id}/confirm`

Explicit confirmation for non-online-payment flows (manual bank transfer
verification, COD). Re-validates and reserves stock. On a paid order this is a
no-op returning the order. `CONFLICT` if cancelled.

### `POST /orders/{id}/cancel`

From `draft`/`payment_pending` only; releases any reservation. `CONFLICT`
otherwise.

### `POST /payments/initiate`

```json
// request
{ "orderId": "ord_000001", "method": "qris" }   // qris | va | ewallet | card
// response 201 — one of two shapes
{
  "payment": {
    "id": "pay_000001", "orderId": "ord_000001", "method": "qris",
    "status": "pending", "expiresAt": "2026-08-25T02:20:00.000Z",
    "kind": "instructions",
    "payload": { "qrString": "000201…", "display": "Scan dengan aplikasi QRIS" }
  }
}
// or, redirect-style providers:
{ "payment": { "id": "pay_…", "kind": "redirect", "url": "https://…", … } }
```

`kind` abstracts the two integration patterns (see REQ-PAY-1): redirect flows
send the customer to `url`; instruction flows render `payload` (QRIS string,
VA number, e-wallet deep link).

### `GET /payments/{id}`

Polling: returns the payment object with `status`:
`pending` | `paid` | `failed` | `expired`.

### `POST /payments/webhook`

Gateway → middleware callback (only exists for Pattern B gateways; see
requirements). For the mock it doubles as the payment simulator.

```json
// request
{ "paymentId": "pay_000001", "event": "payment.succeeded", "reference": "QRIS-…" }
```

Marks the payment `paid`, then auto-confirms the order (returns the order).
`event`: `payment.succeeded` | `payment.failed`.
Real implementation must verify a gateway signature header; the mock accepts
`X-Signature` if `MOCK_WEBHOOK_SECRET` is set (any value).

## Phase 2 endpoints (defined, not built in v1)

Delivery rating, coupons/loyalty, returns/RMA, customer accounts/portal,
order events feed (`GET /events?since=`), multi-pricelist. See
`middleware-requirements.md` for their REQs — they are deliberately absent
from the mock until needed.
