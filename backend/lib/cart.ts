// Cart state lives in the backend database (carts + cart_items); the browser
// cookie carries only a signed cart ID. Prices are never stored — the cart is
// enriched live from the middleware so price/stock changes always win.

import { createHmac, randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { db, ensureSchema } from './db'

export const CART_COOKIE = 'moox_cart'
const MAX_LINES = 20

const SECRET = process.env.CART_COOKIE_SECRET || 'dev-cart-secret'
const sign = (id: string) => createHmac('sha256', SECRET).update(id).digest('base64url')
const serialize = (id: string) => `${id}.${sign(id)}`

function parseCookie(value: string | undefined): string | null {
  if (!value) return null
  const idx = value.lastIndexOf('.')
  if (idx <= 0) return null
  const id = value.slice(0, idx)
  return sign(id) === value.slice(idx + 1) ? id : null
}

/** The caller's open cart, or null when the cookie is absent/invalid/expired. */
export async function currentCartId(): Promise<string | null> {
  const store = await cookies()
  return parseCookie(store.get(CART_COOKIE)?.value)
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
  secure: process.env.NODE_ENV === 'production',
})

export async function setCartCookie(id: string) {
  const store = await cookies()
  store.set(CART_COOKIE, serialize(id), cookieOptions(60 * 60 * 24 * 30))
}

export async function clearCartCookie() {
  const store = await cookies()
  store.set(CART_COOKIE, '', cookieOptions(0))
}

export interface CartLine {
  sku: string
  qty: number
}

/** The caller's open cart without creating one (used by GET). */
export async function findCart(): Promise<{ id: string; items: CartLine[] } | null> {
  await ensureSchema()
  const id = await currentCartId()
  if (!id) return null
  const cart = await db
    .selectFrom('carts')
    .selectAll()
    .where('id', '=', id)
    .where('status', '=', 'open')
    .executeTakeFirst()
  if (!cart) return null
  const items = await db.selectFrom('cart_items').select(['sku', 'qty']).where('cart_id', '=', cart.id).execute()
  return { id: cart.id, items }
}

/** Load (or create) the caller's open cart and return its items. */
export async function getOrCreateCart(): Promise<{ id: string; items: CartLine[] }> {
  const existing = await findCart()
  if (existing) return existing
  await ensureSchema()
  const id = randomUUID()
  const now = new Date().toISOString()
  await db.insertInto('carts').values({ id, created_at: now, updated_at: now, status: 'open' }).execute()
  return { id, items: [] }
}

/** Replace the cart's items wholesale (the API is PUT /cart with full state). */
export async function setCartItems(cartId: string, items: CartLine[]) {
  await ensureSchema()
  if (items.length > MAX_LINES) throw new Error('Too many cart lines')
  await db.transaction().execute(async (tx) => {
    await tx.deleteFrom('cart_items').where('cart_id', '=', cartId).execute()
    if (items.length) {
      await tx.insertInto('cart_items').values(items.map((i) => ({ cart_id: cartId, sku: i.sku, qty: i.qty }))).execute()
    }
    await tx.updateTable('carts').set({ updated_at: new Date().toISOString() }).where('id', '=', cartId).execute()
  })
}

/** After checkout: keep the rows for analytics, but close the cart. */
export async function markCartConverted(cartId: string) {
  await db.updateTable('carts').set({ status: 'converted', updated_at: new Date().toISOString() }).where('id', '=', cartId).execute()
}

/* ── read model: enrich DB lines with live middleware data ─────────────
   Prices are always the middleware's, never stored or trusted from the
   client. Final totals are recomputed by the middleware at order time;
   these are display values. */

import { getInventory, getProducts, type Money } from './middleware'

export interface EnrichedLine {
  sku: string
  name: string
  slug: string
  image: string
  qty: number
  unitPrice: Money
  lineTotal: Money
  freeQty: number
}

export interface CartView {
  items: EnrichedLine[]
  totals: { subtotal: Money; tax: Money; grandTotal: Money; taxIncluded: true }
}

const money = (amount: number): Money => ({ amount, currency: 'IDR' })

export async function enrichedCart(cart: { items: CartLine[] }): Promise<CartView> {
  if (!cart.items.length) {
    const zero = money(0)
    return { items: [], totals: { subtotal: zero, tax: zero, grandTotal: zero, taxIncluded: true } }
  }
  const skus = cart.items.map((i) => i.sku)
  const [{ items: products }, { items: inv }] = await Promise.all([
    getProducts(new URLSearchParams({ skus: skus.join(','), perPage: '100' }).toString()),
    getInventory(skus),
  ])
  const invBy = new Map(inv.map((i) => [i.sku, i.freeQty]))
  // Lines whose product vanished or went non-purchasable drop out of the
  // view; checkout re-validates everything strictly.
  const items = cart.items.flatMap((line) => {
    const p = products.find((x) => x.sku === line.sku && x.status === 'active')
    if (!p) return []
    return [{
      sku: p.sku, name: p.name, slug: p.slug, image: p.image, qty: line.qty,
      unitPrice: p.price, lineTotal: money(p.price.amount * line.qty),
      freeQty: invBy.get(p.sku) ?? 0,
    }]
  })
  const grand = items.reduce((n, l) => n + l.lineTotal.amount, 0)
  const tax = grand - Math.round(grand / 1.12) // PPN included in prices
  return { items, totals: { subtotal: money(grand - tax), tax: money(tax), grandTotal: money(grand), taxIncluded: true } }
}
