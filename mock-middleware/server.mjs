#!/usr/bin/env node
/**
 * Mock implementation of the MOOX commerce middleware contract
 * (docs/commerce/middleware-api.md). Zero dependencies; state lives in
 * data/*.csv (products, inventory) and data/state.json (orders, customers,
 * payments, idempotency). No database — this exists so the Next.js backend
 * can be built and smoke-tested before the real Odoo-backed middleware.
 *
 *   npm start                          # port 7070, dev token
 *   PORT=7070 MIDDLEWARE_API_TOKEN=t npm start
 *
 * The real middleware replaces this service 1:1 behind the same contract.
 */

import { createServer } from 'node:http'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(ROOT, 'data')
const STATE_FILE = join(DATA_DIR, 'state.json')

const PORT = Number(process.env.PORT || 7070)
const TOKEN = process.env.MIDDLEWARE_API_TOKEN || 'dev-mock-token'
const WEBHOOK_SECRET = process.env.MOCK_WEBHOOK_SECRET || ''
const PPN = 0.12 // PPN included in catalog prices; extracted for totals.tax

/* ── CSV (tiny: quoted fields with commas/quotes, that's all we need) ── */

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.length > 1 || row[0] !== '') rows.push(row)
  const [header, ...body] = rows
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

const csvQuote = (v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
const toCsv = (header, rows) =>
  [header.join(','), ...rows.map((r) => header.map((h) => csvQuote(r[h])).join(','))].join('\n') + '\n'

/* ── data loading ────────────────────────────────────────────────────── */

// Products/categories are read-only → reload per request so CSV edits show
// up without a restart. Inventory mutates on confirm, so it stays cached and
// is rewritten in place.
function loadCatalog() {
  const products = parseCsv(readFileSync(join(DATA_DIR, 'products.csv'), 'utf8')).map((p) => ({
    ...p,
    price: Number(p.price_idr),
    compareAt: p.compare_at_idr ? Number(p.compare_at_idr) : null,
    featured: p.featured === 'true',
    images: p.images ? p.images.split('|') : [],
    attributes: p.attributes ? JSON.parse(p.attributes) : {},
  }))
  const categories = parseCsv(readFileSync(join(DATA_DIR, 'categories.csv'), 'utf8'))
  return { products, categories }
}

let inventory = parseCsv(readFileSync(join(DATA_DIR, 'inventory.csv'), 'utf8')).map((r) => ({
  sku: r.sku, warehouse: r.warehouse,
  qtyOnHand: Number(r.qty_on_hand), qtyReserved: Number(r.qty_reserved),
}))

function persistInventory() {
  writeFileSync(join(DATA_DIR, 'inventory.csv'), toCsv(
    ['sku', 'warehouse', 'qty_on_hand', 'qty_reserved'],
    inventory.map((r) => ({
      sku: r.sku, warehouse: r.warehouse,
      qty_on_hand: r.qtyOnHand, qty_reserved: r.qtyReserved,
    })),
  ))
}

function loadState() {
  if (!existsSync(STATE_FILE)) return { seq: 0, customers: [], orders: [], payments: [], idempotency: {} }
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')) } catch { return { seq: 0, customers: [], orders: [], payments: [], idempotency: {} } }
}

const state = loadState()
const persistState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
const nextId = (prefix) => `${prefix}_${String(++state.seq).padStart(6, '0')}`

/* ── domain helpers ──────────────────────────────────────────────────── */

const freeQtyFor = (sku) =>
  inventory.filter((r) => r.sku === sku).reduce((n, r) => n + r.qtyOnHand - r.qtyReserved, 0)

const reserveStock = (items) => {
  for (const it of items) {
    const row = inventory.find((r) => r.sku === it.sku)
    row.qtyReserved += it.qty
  }
  persistInventory()
}

const money = (amount) => ({ amount, currency: 'IDR' })

function orderTotals(items) {
  const grand = items.reduce((n, it) => n + it.unitPrice.amount * it.qty, 0)
  const tax = grand - Math.round(grand / (1 + PPN)) // PPN included in price
  return {
    subtotal: money(grand - tax), tax: money(tax), shipping: money(0),
    grandTotal: money(grand), taxIncluded: true,
  }
}

function publicOrder(o) {
  const out = {
    id: o.id, number: o.number, status: o.status, items: o.items,
    totals: o.totals, createdAt: o.createdAt,
  }
  if (o.paymentId) {
    const p = state.payments.find((x) => x.id === o.paymentId)
    if (p) out.payment = {
      id: p.id, method: p.method, status: p.status,
      paidAt: p.paidAt || null,
    }
  }
  return out
}

function upsertCustomer(input) {
  let c = state.customers.find((x) => x.email.toLowerCase() === input.email.toLowerCase())
  if (!c) { c = { id: nextId('cus'), ...input }; state.customers.push(c) }
  else Object.assign(c, input)
  return c
}

/* ── http plumbing ───────────────────────────────────────────────────── */

const hash = (s) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(16)
}

class ApiError extends Error {
  constructor(status, code, message, retryable = false, details) {
    super(message)
    this.status = status; this.code = code; this.retryable = retryable; this.details = details
  }
}

function send(res, status, body, extraHeaders = {}) {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...extraHeaders })
  res.end(json)
}

async function readJson(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  if (!chunks.length) throw new ApiError(400, 'VALIDATION', 'JSON body required')
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new ApiError(400, 'VALIDATION', 'Malformed JSON body') }
}

const requireStr = (obj, key) => {
  if (typeof obj?.[key] !== 'string' || !obj[key].trim())
    throw new ApiError(400, 'VALIDATION', `Field "${key}" is required`)
  return obj[key].trim()
}

/* ── endpoint handlers ───────────────────────────────────────────────── */

const routes = []

function route(method, pattern, handler) {
  const names = []
  const rx = new RegExp('^' + pattern.replace(/:[a-zA-Z]+/g, (m) => { names.push(m.slice(1)); return '([^/]+)' }) + '$')
  routes.push({ method, rx, names, handler })
}

route('GET', '/health', () => ({ status: 'ok', version: 'v1', mode: 'mock' }))

route('GET', '/catalog/categories', (m, q, body, { catalog }) => ({
  categories: catalog.categories.map((c) => ({
    slug: c.slug, name: c.name, parent: c.parent || null,
    count: catalog.products.filter((p) => p.category === c.slug && p.status === 'active').length,
  })),
}))

route('GET', '/catalog/products', (m, q, body, { catalog, etag }) => {
  let items = catalog.products.filter((p) => p.status !== 'archived')
  if (q.get('category')) items = items.filter((p) => p.category === q.get('category'))
  if (q.get('featured') === 'true') items = items.filter((p) => p.featured)
  if (q.get('skus')) {
    const skus = q.get('skus').split(',').map((s) => s.trim()).filter(Boolean)
    items = items.filter((p) => skus.includes(p.sku))
  }
  if (q.get('q')) {
    const term = q.get('q').toLowerCase()
    items = items.filter((p) => (p.name + ' ' + p.description_short).toLowerCase().includes(term))
  }
  const page = Math.max(1, Number(q.get('page') || 1))
  const perPage = Math.min(100, Math.max(1, Number(q.get('perPage') || 20)))
  const total = items.length
  items = items.slice((page - 1) * perPage, page * perPage)
  return etag.json({ items: items.map(summary), page, perPage, total }, {
    'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
  })
})

route('GET', '/catalog/products/:slug', (m, q, body, { catalog, etag }) => {
  const p = catalog.products.find((x) => x.slug === m.slug)
  if (!p) throw new ApiError(404, 'NOT_FOUND', `No product with slug "${m.slug}"`)
  return etag.json({ product: { ...summary(p), images: p.images, descriptionShort: p.description_short, descriptionLong: p.description_long, attributes: p.attributes, stock: { freeQty: freeQtyFor(p.sku) } } }, {
    'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
  })
})

function summary(p) {
  return {
    sku: p.sku, slug: p.slug, name: p.name, categorySlug: p.category,
    price: money(p.price),
    compareAt: p.compareAt ? money(p.compareAt) : null,
    status: p.status, featured: p.featured, image: p.image,
  }
}

route('GET', '/inventory', (m, q) => {
  const skus = (q.get('skus') || '').split(',').map((s) => s.trim()).filter(Boolean)
  const rows = inventory.filter((r) => !skus.length || skus.includes(r.sku))
  const bySku = new Map()
  for (const r of rows) {
    const e = bySku.get(r.sku) || { sku: r.sku, warehouses: [], freeQty: 0 }
    e.warehouses.push({ code: r.warehouse, qtyOnHand: r.qtyOnHand, qtyReserved: r.qtyReserved, freeQty: r.qtyOnHand - r.qtyReserved })
    e.freeQty += r.qtyOnHand - r.qtyReserved
    bySku.set(r.sku, e)
  }
  return { items: [...bySku.values()] }
})

route('POST', '/customers', (m, q, body) => {
  const input = {
    name: requireStr(body, 'name'),
    email: requireStr(body, 'email'),
    phone: requireStr(body, 'phone'),
    address: requireAddress(body.address),
  }
  const c = upsertCustomer(input)
  persistState()
  return { status: 200, body: { customer: { id: c.id, name: c.name, email: c.email } } }
})

function requireAddress(a) {
  if (!a || typeof a !== 'object') throw new ApiError(400, 'VALIDATION', 'Field "address" is required')
  return {
    line1: requireStr(a, 'line1'), line2: String(a.line2 || ''),
    city: requireStr(a, 'city'), province: requireStr(a, 'province'),
    postalCode: requireStr(a, 'postalCode'), country: a.country || 'ID',
  }
}

function buildOrderItems(catalog, rawItems) {
  if (!Array.isArray(rawItems) || !rawItems.length)
    throw new ApiError(400, 'VALIDATION', '"items" must be a non-empty array')
  const { products } = catalog
  return rawItems.map((it) => {
    const qty = Number(it.qty)
    if (!Number.isInteger(qty) || qty < 1 || qty > 10)
      throw new ApiError(400, 'VALIDATION', `Invalid qty for ${it.sku}`)
    const p = products.find((x) => x.sku === it.sku)
    if (!p) throw new ApiError(400, 'VALIDATION', `Unknown sku "${it.sku}"`)
    if (p.status !== 'active') throw new ApiError(409, 'CONFLICT', `"${p.sku}" is not purchasable (${p.status})`)
    return { sku: p.sku, name: p.name, qty, unitPrice: money(p.price), lineTotal: money(p.price * qty) }
  })
}

function assertStock(items) {
  const short = items
    .map((it) => ({ sku: it.sku, requested: it.qty, freeQty: freeQtyFor(it.sku) }))
    .filter((x) => x.requested > x.freeQty)
  if (short.length) throw new ApiError(409, 'OUT_OF_STOCK', 'Insufficient stock', false, short)
}

route('POST', '/orders', (m, q, body, { catalog, idempotent }) =>
  idempotent(async () => {
    let customer
    if (body.customerId) {
      customer = state.customers.find((c) => c.id === body.customerId)
      if (!customer) throw new ApiError(400, 'VALIDATION', `Unknown customerId "${body.customerId}"`)
    } else if (body.customer) {
      customer = upsertCustomer({
        name: requireStr(body.customer, 'name'), email: requireStr(body.customer, 'email'),
        phone: requireStr(body.customer, 'phone'), address: requireAddress(body.customer.address),
      })
    } else throw new ApiError(400, 'VALIDATION', 'Provide "customerId" or "customer"')

    const items = buildOrderItems(catalog, body.items)
    assertStock(items)

    const order = {
      id: nextId('ord'), number: `MOOX-${String(state.seq).padStart(6, '0')}`,
      customerId: customer.id, status: 'draft', items,
      totals: orderTotals(items), createdAt: new Date().toISOString(),
    }
    state.orders.push(order)
    persistState()
    return { status: 201, body: { order: publicOrder(order) } }
  }))

route('GET', '/orders/:id', (m) => {
  const o = state.orders.find((x) => x.id === m.id)
  if (!o) throw new ApiError(404, 'NOT_FOUND', `No order "${m.id}"`)
  return { order: publicOrder(o) }
})

function confirmOrder(o) {
  assertStock(o.items) // re-validate: nothing was held while draft (REQ-INV-2)
  reserveStock(o.items)
  o.status = 'confirmed'
  o.confirmedAt = new Date().toISOString()
  persistState()
  return publicOrder(o)
}

route('POST', '/orders/:id/confirm', (m) => {
  const o = state.orders.find((x) => x.id === m.id)
  if (!o) throw new ApiError(404, 'NOT_FOUND', `No order "${m.id}"`)
  if (o.status === 'cancelled') throw new ApiError(409, 'CONFLICT', 'Order is cancelled')
  if (o.status === 'confirmed' || o.status === 'shipped' || o.status === 'delivered') return { order: publicOrder(o) }
  return { order: confirmOrder(o) }
})

route('POST', '/orders/:id/cancel', (m) => {
  const o = state.orders.find((x) => x.id === m.id)
  if (!o) throw new ApiError(404, 'NOT_FOUND', `No order "${m.id}"`)
  if (o.status !== 'draft' && o.status !== 'payment_pending')
    throw new ApiError(409, 'CONFLICT', `Cannot cancel order in status "${o.status}"`)
  o.status = 'cancelled'
  const p = state.payments.find((x) => x.id === o.paymentId)
  if (p && p.status === 'pending') p.status = 'expired'
  persistState()
  return { order: publicOrder(o) }
})

route('POST', '/payments/initiate', (m, q, body, { idempotent }) =>
  idempotent(async () => {
    const o = state.orders.find((x) => x.id === body.orderId)
    if (!o) throw new ApiError(400, 'VALIDATION', `Unknown orderId "${body.orderId}"`)
    if (o.status !== 'draft' && o.status !== 'payment_pending')
      throw new ApiError(409, 'CONFLICT', `Cannot initiate payment for order in "${o.status}"`)
    const method = body.method
    if (!['qris', 'va', 'ewallet', 'card'].includes(method))
      throw new ApiError(400, 'VALIDATION', '"method" must be qris|va|ewallet|card')

    o.status = 'payment_pending'
    const payment = {
      id: nextId('pay'), orderId: o.id, method, status: 'pending',
      expiresAt: new Date(Date.now() + (method === 'va' ? 24 * 3600e3 : 20 * 60e3)).toISOString(),
      ...(method === 'card'
        ? { kind: 'redirect', url: `https://mock-pay.local/checkout/${o.id}` }
        : { kind: 'instructions', payload: instructionsFor(method, o) }),
    }
    o.paymentId = payment.id
    state.payments.push(payment)
    persistState()
    return { status: 201, body: { payment } }
  }))

function instructionsFor(method, o) {
  const amount = o.totals.grandTotal.amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })
  if (method === 'qris') return { qrString: `00020126MOOX-MOCK${o.id}540363605802ID59MOOX6006JAKARTA54${amount}`, display: `Scan QRIS — ${amount}` }
  if (method === 'va') return { bank: 'BCA', vaNumber: `8077${String(Math.abs(hash(o.id)) % 1e8).padStart(8, '0')}`, display: `Transfer ${amount} ke VA BCA` }
  return { deepLink: `mooxmock://pay/${o.id}`, display: `Selesaikan pembayaran e-wallet — ${amount}` }
}

route('GET', '/payments/:id', (m) => {
  const p = state.payments.find((x) => x.id === m.id)
  if (!p) throw new ApiError(404, 'NOT_FOUND', `No payment "${m.id}"`)
  return { payment: p }
})

route('POST', '/payments/webhook', (m, q, body, { req }) => {
  if (WEBHOOK_SECRET && req.headers['x-signature'] !== WEBHOOK_SECRET)
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid webhook signature')
  const p = state.payments.find((x) => x.id === body.paymentId)
  if (!p) throw new ApiError(404, 'NOT_FOUND', `No payment "${body.paymentId}"`)
  if (p.status === 'paid') return { order: publicOrder(state.orders.find((o) => o.id === p.orderId)) } // already processed
  if (body.event === 'payment.succeeded') {
    p.status = 'paid'; p.paidAt = new Date().toISOString()
    if (body.reference) p.reference = body.reference
    const o = state.orders.find((x) => x.id === p.orderId)
    if (o && o.status !== 'confirmed' && o.status !== 'cancelled') confirmOrder(o) // auto-confirm on payment
    persistState()
    return { order: publicOrder(o) }
  }
  if (body.event === 'payment.failed') {
    p.status = 'failed'
    const o = state.orders.find((x) => x.id === p.orderId)
    if (o && o.status === 'payment_pending') o.status = 'draft'
    persistState()
    return { order: publicOrder(o) }
  }
  throw new ApiError(400, 'VALIDATION', '"event" must be payment.succeeded|payment.failed')
})

/* ── request context helpers ─────────────────────────────────────────── */

function loadRequestContext() {
  const catalog = loadCatalog()
  const etag = {
    json(body, headers) {
      const tag = `"${hash(JSON.stringify(body))}"`
      return { status: 200, body, headers: { ...headers, etag: tag }, etag: tag }
    },
  }
  return { catalog, etag }
}

/* ── server ──────────────────────────────────────────────────────────── */

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const started = Date.now()
  try {
    if (url.pathname !== '/health' && req.headers.authorization !== `Bearer ${TOKEN}`)
      throw new ApiError(401, 'UNAUTHORIZED', 'Missing or invalid bearer token')

    for (const r of routes) {
      if (r.method !== req.method) continue
      const match = r.rx.exec(url.pathname)
      if (!match) continue
      const params = Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(match[i + 1])]))
      const body = req.method === 'POST' ? await readJson(req) : null

      const ctx = {
        ...loadRequestContext(),
        req,
        idempotent(fn) {
          const key = req.headers['idempotency-key']
          if (!key) return fn() // contract strongly recommends keys; mock tolerates absence
          const hit = state.idempotency[key]
          if (hit) {
            send(res, hit.status, hit.body, { 'x-idempotent-replay': 'true' })
            return { replayed: true }
          }
          return (async () => {
            const result = await fn()
            state.idempotency[key] = { status: result.status || 200, body: result.body }
            persistState()
            return result
          })()
        },
      }

      const result = await r.handler(params, url.searchParams, body, ctx)
      if (result?.replayed) break
      if (result?.etag) {
        if (req.headers['if-none-match'] === result.etag) {
          res.writeHead(304, { etag: result.etag })
          res.end()
          break
        }
        send(res, result.status, result.body, result.headers)
        break
      }
      send(res, typeof result?.status === 'number' ? result.status : 200, result?.body ?? result)
      break
    }
    if (!res.writableEnded) throw new ApiError(404, 'NOT_FOUND', `No route for ${req.method} ${url.pathname}`)
    console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`)
  } catch (err) {
    const api = err instanceof ApiError
      ? err
      : new ApiError(500, 'INTERNAL', err.message, true)
    send(res, api.status, { error: { code: api.code, message: api.message, retryable: api.retryable, ...(api.details ? { details: api.details } : {}) } })
    console.error(`${req.method} ${url.pathname} ${api.status} ${api.message}`)
  }
})

server.listen(PORT, () => {
  console.log(`mock-middleware on http://localhost:${PORT} (token: ${TOKEN === 'dev-mock-token' ? 'dev-mock-token (default)' : 'from env'})`)
  console.log(`contract: docs/commerce/middleware-api.md · state: ${STATE_FILE}`)
})
