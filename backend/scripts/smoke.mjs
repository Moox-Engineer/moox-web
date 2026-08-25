#!/usr/bin/env node
/**
 * End-to-end smoke test for the commerce stack: spawns the mock middleware
 * and the Next.js backend, then walks the full flow — catalog → cart →
 * checkout → payment → confirmed order — with assertions. Exits non-zero on
 * any failure. Run from backend/:  node scripts/smoke.mjs
 *
 * Resets mock data (state.json, inventory.csv) and uses a throwaway SQLite
 * file (data/smoke.db) so repeated runs start clean.
 */

import { spawn } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BACKEND = dirname(dirname(fileURLToPath(import.meta.url)))
const REPO = dirname(BACKEND)
const MOCK = join(REPO, 'mock-middleware')

const MOCK_PORT = 7071
const API_PORT = 3101
const API = `http://localhost:${API_PORT}`

const PRISTINE_INVENTORY = `sku,warehouse,qty_on_hand,qty_reserved
AKASA-01,JKT,15,3
AXELA-01,JKT,20,2
AXINA-01,JKT,8,0
ASINA-01,JKT,0,0
`

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures++
}

async function waitFor(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 401) return // 401 = alive but gated
    } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function spawnNode(args, opts) {
  const child = spawn(process.execPath, args, { stdio: 'ignore', ...opts })
  spawned.push(child.pid)
  return child
}
const spawned = []

const killAll = () => {
  for (const pid of spawned) {
    try { process.kill(pid) } catch {}
    try { spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' }) } catch {}
  }
}
process.on('exit', killAll)

/* ── run ─────────────────────────────────────────────────────────────── */

rmSync(join(MOCK, 'data', 'state.json'), { force: true })
writeFileSync(join(MOCK, 'data', 'inventory.csv'), PRISTINE_INVENTORY)
rmSync(join(BACKEND, 'data', 'smoke.db'), { force: true })

console.log('starting mock middleware + next dev…')
spawnNode([join(MOCK, 'server.mjs')], { env: { ...process.env, PORT: String(MOCK_PORT) }, cwd: MOCK })
spawnNode([join(BACKEND, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(API_PORT)], {
  env: {
    ...process.env,
    MIDDLEWARE_BASE_URL: `http://localhost:${MOCK_PORT}`,
    SQLITE_PATH: join(BACKEND, 'data', 'smoke.db'),
  },
  cwd: BACKEND,
})

let cookie = ''
const j = (res) => res.json()
async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  return { status: res.status, data: await res.json().catch(() => null) }
}

try {
  await waitFor(`${API}/api/v1/products`)
  console.log('stack up — running flow\n')

  console.log('catalog')
  const products = await call('GET', '/api/v1/products?perPage=50')
  ok('product list', products.status === 200 && products.data.items.length >= 4, `${products.data?.items?.length} items`)
  const akasa = products.data.items.find((p) => p.sku === 'AKASA-01')
  ok('akasa present with price', akasa?.price?.amount === 2999000)
  const detail = await call('GET', '/api/v1/products/moo-axina')
  ok('product detail with stock', detail.data?.product?.stock?.freeQty === 8, `freeQty=${detail.data?.product?.stock?.freeQty}`)
  const comingSoon = await call('GET', '/api/v1/products/moo-asina')
  ok('coming_soon served', comingSoon.status === 200 && comingSoon.data.product.status === 'coming_soon')

  console.log('cart')
  ok('empty cart', (await call('GET', '/api/v1/cart')).data.cart.items.length === 0)
  const put = await call('PUT', '/api/v1/cart', { items: [{ sku: 'AKASA-01', qty: 1 }, { sku: 'AXINA-01', qty: 2 }] })
  ok('cart persisted + enriched', put.data.cart.items.length === 2 && put.data.cart.items[0].name === 'MOO Akasa')
  ok('totals computed', put.data.cart.totals.grandTotal.amount === 12997000, `grand=${put.data.cart.totals.grandTotal.amount}`)
  ok('cart roundtrip via cookie', (await call('GET', '/api/v1/cart')).data.cart.items.length === 2)
  ok('unknown sku rejected', (await call('PUT', '/api/v1/cart', { items: [{ sku: 'NOPE', qty: 1 }] })).status === 400)

  console.log('checkout')
  const checkoutBody = {
    customer: {
      name: 'Siti Rahma', email: 'SITI@Example.com', phone: '+628120000000',
      address: { line1: 'Jl. Sudirman 1', city: 'Jakarta Selatan', province: 'DKI Jakarta', postalCode: '12190' },
    },
    paymentMethod: 'qris',
  }
  const co = await call('POST', '/api/v1/checkout', checkoutBody)
  ok('order created', co.status === 201 && co.data.order.status === 'draft', co.data?.order?.id)
  ok('payment initiated (qris)', co.data.payment?.kind === 'instructions' && !!co.data.payment?.payload?.qrString)
  ok('cart cleared', (await call('GET', '/api/v1/cart')).data.cart.items.length === 0)
  const empty = await call('POST', '/api/v1/checkout', checkoutBody)
  ok('empty-cart checkout rejected', empty.status === 400)

  console.log('payment + order')
  const mockToken = process.env.MIDDLEWARE_API_TOKEN || 'dev-mock-token'
  const wh = await fetch(`http://localhost:${MOCK_PORT}/payments/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${mockToken}` },
    body: JSON.stringify({ paymentId: co.data.payment.id, event: 'payment.succeeded' }),
  }).then(j)
  ok('webhook auto-confirms', wh.order?.status === 'confirmed')
  const order = await call('GET', `/api/v1/orders/${co.data.order.id}?email=siti@example.com`)
  ok('order lookup (email normalized)', order.status === 200 && order.data.order.status === 'confirmed')
  ok('wrong email → 404', (await call('GET', `/api/v1/orders/${co.data.order.id}?email=x@x.com`)).status === 404)
  const inv = await fetch(`http://localhost:${MOCK_PORT}/inventory?skus=AKASA-01,AXINA-01`, { headers: { authorization: `Bearer ${mockToken}` } }).then(j)
  const bySku = Object.fromEntries(inv.items.map((i) => [i.sku, i.freeQty]))
  ok('stock reserved', bySku['AKASA-01'] === 11 && bySku['AXINA-01'] === 6, JSON.stringify(bySku))

  console.log('storefront')
  const page = await fetch(`${API}/products`).then((r) => r.text())
  ok('products page renders', page.includes('MOO Axina') && page.includes('card'))
} catch (e) {
  console.error('smoke failed to run:', e.message)
  failures++
}

console.log(`\n${failures ? `FAILED (${failures})` : 'ALL PASSED'}`)
process.exit(failures ? 1 : 0)
