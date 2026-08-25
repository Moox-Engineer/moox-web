# mock-middleware

Mock of the MOOX commerce middleware contract — `docs/commerce/middleware-api.md`.
Zero dependencies, no database: products/categories/inventory from `data/*.csv`,
orders/customers/payments/idempotency in `data/state.json` (created at runtime).
The real middleware (Odoo 19-backed, own repo) replaces this 1:1.

```bash
npm start                # http://localhost:7070, token: dev-mock-token
```

Env: `PORT`, `MIDDLEWARE_API_TOKEN` (default `dev-mock-token`),
`MOCK_WEBHOOK_SECRET` (if set, `POST /payments/webhook` requires
`X-Signature` to match). CSV edits appear without restart; the mock only
mutates `inventory.csv` (reservations) and `state.json`. Delete both to
reset. `npm run` scripts and smoke tests live in `../backend/`.
