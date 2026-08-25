# Odoo 19 — External API Research Notes

Findings behind `middleware-requirements.md`, researched 2026-08-25.
Mirrored in the Obsidian vault (`02-research/odoo/`). Sources at the end.

## 1. API surface

| API | Status in 19 | Notes |
|---|---|---|
| **JSON-2** `POST /json/2/<model>/<method>` | New in 19, official | Bearer API key auth, named-only args, optional `X-Odoo-Database`. Read-only methods auto-run in readonly cursors. **Refuses private `_`-prefixed methods.** |
| Legacy JSON-RPC `/jsonrpc` + `execute_kw` | Supported | No private-method filter — needed for `_get_products_price`, coupon apply, delivery setters. |
| Legacy XML-RPC `/xmlrpc` | Deprecated | Removal: Odoo 22 (fall 2028), Odoo Online 21.1 (winter 2027). Don't build on it. |
| `/web/dataset/call_kw` | Supported | Not deprecated; same shape as legacy jsonrpc. |
| REST / GraphQL | None official | OCA `base_rest`/`graphql_base` exist; not needed for our shape. |

Docs claim external API access is gated to "Custom" Odoo **Online** plans;
the code ships un-gated in self-hosted Community. If we host Odoo ourselves
(planned), this is moot.

## 2. The private-method split (the main transport wart)

`get_public_method` raises `AccessError` for `_`-prefixed methods under
JSON-2; `execute_kw` (legacy) routes them fine. Commerce-relevant privates:

- `product.pricelist._get_products_price` / `_get_product_price`
- `sale.order._try_apply_code` (loyalty/coupon apply)
- `sale.order._set_delivery_method` (in 19, delivery-selection helpers live
  inside `website_sale`; the old `website_sale_delivery` module no longer
  exists separately)

→ Middleware keeps both transports (REQ-TR-3) or ships a thin custom Odoo
module with public wrappers. Odoo's own docs recommend the latter for
multi-step business actions.

## 3. Auth

- API keys: 160-bit, shown once, **duration mandatory, max 3 months** in 19;
  programmatic generate/revoke exists (`res.users.apikeys/*`, admin-gated,
  10 keys/user default). Plan rotation as ops, not rewrite.
- Keys inherit the user's full ACLs — no scoping. Use dedicated bot users
  with trimmed rights. (A stock-read user matters: `qty_available` has
  `compute_sudo=False` — the API caller's access rights affect computation.)
- No native JWT/OIDC-provider API auth; OCA `auth_jwt`/`auth_oidc` if ever
  needed. We don't need it (service-token edge + Odoo key internally).

## 4. Cart & orders headless

`website_sale`'s cart is HTTP-session-bound (`sale_get_order`, CSRF'd http
controllers) — unusable via RPC. Standard headless pattern (confirmed across
forum threads + 19 controller source): create `sale.order` directly with
`order_line = [(0,0,{product_id, product_uom_qty})]`, then `action_confirm()`
(public). That's what the middleware does; cart lives in our Next.js
backend's cookie.

## 5. Payments

- Official 19 Community connectors include Stripe, Adyen, PayPal, **Xendit**
  (since 17: QRIS/VA/e-wallets), Mollie, Razorpay, Flutterwave, +20 more.
  **Midtrans and DOKU are NOT official** (OCA payment-provider repo has no
  19.0 branch as of this research; Apps-Store third-party modules unverified).
- Headless: checkout flow is web-session based. Two patterns (REQ-PAY-1):
  (A) Odoo payment link (`payment.link.wizard` / `/payment/pay`) + official
  connector; (B) own the gateway (Midtrans direct), verify webhooks, record
  payment onto the invoice via API (`account.payment` create+post is public).

## 6. Events / webhooks

- **Inbound** webhooks (`/web/hook/<uuid>` via `base_automation`) exist in
  Community.
- **Outbound** "Send Webhook Notification" automation is Studio (Enterprise).
  Community alternatives: custom server action, OCA modules, or polling
  `write_date` deltas → our Phase 2 events feed.

## 7. Other limits the middleware absorbs

- **No multi-call transactions**: every external call commits alone. →
  idempotency keys + compensation (REQ-ORD-2, REQ-NF-2).
- **Stock race**: reservation happens at picking confirmation, not draft —
  re-validate at confirm (REQ-INV-2).
- **Rate**: Odoo Online ≈60 req/min → 429 (community-reported); batch +
  cache regardless (REQ-NF-1). `search_read` caps at 100 records without
  explicit paging.
- **Images**: binary fields are base64-through-JSON (heavy; writes trigger
  attachment resizes) — always `/web/image/...` URLs (REQ-CAT-2).
- **Search**: no headless full-text search; domains (`ilike`) fine for v1.
- **i18n**: reads honor `context.lang` (`id_ID`); build own slugs/URLs.
- **Community vs Enterprise**: Community covers every data-plane need we
  have (sale, stock, delivery-generic, payment incl. Xendit, loyalty,
  `l10n_id`, credit notes). Enterprise buys carrier connectors (DHL/UPS/…),
  Studio automations, accounting extras — none load-bearing for us.

## 8. Indonesia specifics

- `l10n_id` (CoA, PPN/PPh codes), `l10n_id_efaktur_coretax` (DJP Coretax XML
  export) in Community 19. (Docs also mention `l10n_id_efaktur`; only the
  `_coretax` module exists in the 19 Community tree — verify at build time.)
- PPN display: contract prices are tax-inclusive; totals sourced from Odoo
  `sale.order.amount_total` / `amount_by_group` so fiscal-position logic
  stays in Odoo.

## Sources

- Odoo 19 docs: [External JSON-2 API](https://www.odoo.com/documentation/19.0/developer/reference/external_api.html) ·
  [External RPC API (deprecation)](https://www.odoo.com/documentation/19.0/developer/reference/external_rpc_api.html) ·
  [ORM commands](https://www.odoo.com/documentation/19.0/developer/reference/backend/orm.html) ·
  [Payment providers](https://www.odoo.com/documentation/19.0/applications/finance/payment_providers.html) ·
  [Xendit](https://www.odoo.com/documentation/19.0/applications/finance/payment_providers/xendit.html) ·
  [Indonesia localization](https://www.odoo.com/documentation/19.0/applications/finance/fiscal_localizations/indonesia.html) ·
  [Webhooks](https://www.odoo.com/documentation/19.0/applications/studio/automated_actions/webhooks.html)
- Source: [addons/rpc (JSON-2 controllers)](https://github.com/odoo/odoo/tree/19.0/addons/rpc) ·
  [odoo/service/model.py (private-method filter)](https://github.com/odoo/odoo/blob/19.0/odoo/service/model.py) ·
  [website_sale/controllers/main.py](https://github.com/odoo/odoo/blob/19.0/addons/website_sale/controllers/main.py) ·
  [delivery/models/delivery_carrier.py](https://github.com/odoo/odoo/blob/19.0/addons/delivery/models/delivery_carrier.py) ·
  [stock/models/product.py](https://github.com/odoo/odoo/blob/19.0/addons/stock/models/product.py) ·
  [payment/wizards/payment_link_wizard.py](https://github.com/odoo/odoo/blob/19.0/addons/payment/wizards/payment_link_wizard.py)
- Community: [getknit Odoo API guide (rate limits)](https://www.getknit.dev/blog/odoo-api-integration-guide-in-depth) ·
  [MAESN — Odoo API access explained](https://www.maesn.com/blog/odoo-api-access-explained) ·
  Odoo forums: [cart via XMLRPC](https://www.odoo.com/forum/help-1/how-add-item-to-cart-using-xmlrpc-76872) ·
  [prices via JSON API](https://www.odoo.com/forum/help-1/how-do-i-get-product-prices-with-json-api-279626) ·
  [coupon via XML-RPC](https://www.odoo.com/forum/help-1/how-to-apply-coupon-promotion-code-for-a-sale-order-through-xml-rpc-271190) ·
  [carrier via external API](https://www.odoo.com/forum/help-1/how-do-i-add-a-shipping-method-carrier-using-the-external-api-274087)
