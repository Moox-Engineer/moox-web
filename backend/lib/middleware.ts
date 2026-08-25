// Typed client for the commerce middleware contract
// (docs/commerce/middleware-api.md). The mock (mock-middleware/) and the
// future real middleware both speak this shape.

const BASE = process.env.MIDDLEWARE_BASE_URL || 'http://localhost:7070'
const TOKEN = process.env.MIDDLEWARE_API_TOKEN || 'dev-mock-token'

// Product images come back as paths (/images/akasa-1.jpg) — resolved against
// the marketing site, which owns the assets (Vite dev server in development).
const ASSETS_BASE = process.env.NEXT_PUBLIC_ASSETS_BASE || 'http://localhost:3000'
export const assetUrl = (path: string) => ASSETS_BASE + path

/* ── contract types ──────────────────────────────────────────────────── */

export interface Money {
  amount: number
  currency: string
}

export interface ProductSummary {
  sku: string
  slug: string
  name: string
  categorySlug: string
  price: Money
  compareAt: Money | null
  status: 'active' | 'coming_soon' | 'archived'
  featured: boolean
  image: string
}

export interface ProductDetail extends ProductSummary {
  images: string[]
  descriptionShort: string
  descriptionLong: string
  attributes: Record<string, string[]>
  stock: { freeQty: number }
}

export interface Category {
  slug: string
  name: string
  parent: string | null
  count: number
}

export interface OrderLine {
  sku: string
  name: string
  qty: number
  unitPrice: Money
  lineTotal: Money
}

export interface OrderTotals {
  subtotal: Money
  tax: Money
  shipping: Money
  grandTotal: Money
  taxIncluded: boolean
}

export interface Order {
  id: string
  number: string
  status: 'draft' | 'payment_pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'failed'
  items: OrderLine[]
  totals: OrderTotals
  createdAt: string
  payment?: { id: string; method: string; status: string; paidAt: string | null }
}

export interface Payment {
  id: string
  orderId: string
  method: string
  status: 'pending' | 'paid' | 'failed' | 'expired'
  expiresAt: string
  kind: 'redirect' | 'instructions'
  url?: string
  payload?: Record<string, string>
}

export interface CustomerInput {
  name: string
  email: string
  phone: string
  address: {
    line1: string
    line2?: string
    city: string
    province: string
    postalCode: string
    country?: string
  }
}

/* ── client ──────────────────────────────────────────────────────────── */

export class MiddlewareError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

interface MiddlewareFetchInit {
  method?: string
  body?: unknown
  idempotencyKey?: string
  revalidate?: number
}

export async function mw<T>(path: string, init: MiddlewareFetchInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method || 'GET',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
      ...(init.idempotencyKey ? { 'idempotency-key': init.idempotencyKey } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    ...(init.revalidate !== undefined ? { next: { revalidate: init.revalidate } } : {}),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = data?.error
    throw new MiddlewareError(res.status, err?.code || 'INTERNAL', err?.message || res.statusText, err?.retryable ?? true, err?.details)
  }
  return data as T
}

/* ── endpoint helpers ────────────────────────────────────────────────── */

export const getProducts = (qs = '', revalidate = 60) => mw<{ items: ProductSummary[]; page: number; perPage: number; total: number }>(`/catalog/products${qs ? `?${qs}` : ''}`, { revalidate })

export const getProduct = (slug: string) => mw<{ product: ProductDetail }>(`/catalog/products/${encodeURIComponent(slug)}`, { revalidate: 60 })

export const getCategories = () => mw<{ categories: Category[] }>('/catalog/categories', { revalidate: 300 })

export const getInventory = (skus: string[]) => mw<{ items: { sku: string; freeQty: number }[] }>(`/inventory?skus=${skus.map(encodeURIComponent).join(',')}`)

export const createOrder = (input: { customer: CustomerInput; items: { sku: string; qty: number }[] }, idempotencyKey: string) =>
  mw<{ order: Order }>('/orders', { method: 'POST', body: input, idempotencyKey })

export const initiatePayment = (orderId: string, method: string, idempotencyKey: string) =>
  mw<{ payment: Payment }>('/payments/initiate', { method: 'POST', body: { orderId, method }, idempotencyKey })

export const getOrder = (id: string) => mw<{ order: Order }>(`/orders/${encodeURIComponent(id)}`)
