import { NextRequest, NextResponse } from 'next/server'
import { findCart, getOrCreateCart, setCartItems, setCartCookie, enrichedCart, type CartLine } from '@/lib/cart'
import { getProducts } from '@/lib/middleware'
import { apiError, ValidationError } from '@/lib/api'

/** GET /api/v1/cart — the caller's cart enriched with live price/stock. */
export async function GET() {
  try {
    const cart = await findCart()
    return NextResponse.json({ cart: await enrichedCart(cart ?? { items: [] }) })
  } catch (e) {
    return apiError(e)
  }
}

/** PUT /api/v1/cart — replace cart contents wholesale: { items: [{sku, qty}] }. */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const raw = body?.items
    if (!Array.isArray(raw) || raw.length > 20) throw new ValidationError('"items" must be an array of at most 20 lines')

    const items: CartLine[] = raw.map((i: { sku?: unknown; qty?: unknown }) => {
      if (typeof i.sku !== 'string' || !Number.isInteger(i.qty) || (i.qty as number) < 1 || (i.qty as number) > 10)
        throw new ValidationError(`Invalid item ${JSON.stringify(i)}`)
      return { sku: i.sku, qty: i.qty as number }
    })

    if (items.length) {
      const { items: available } = await getProducts(new URLSearchParams({ skus: items.map((i) => i.sku).join(','), perPage: '100' }).toString())
      for (const it of items) {
        if (!available.some((p) => p.sku === it.sku && p.status === 'active'))
          throw new ValidationError(`"${it.sku}" is not available`)
      }
    }

    const cart = await getOrCreateCart()
    await setCartItems(cart.id, items)
    await setCartCookie(cart.id)
    return NextResponse.json({ cart: await enrichedCart({ items }) })
  } catch (e) {
    return apiError(e)
  }
}
