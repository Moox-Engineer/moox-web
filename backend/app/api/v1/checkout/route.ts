import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { findCart, markCartConverted, clearCartCookie } from '@/lib/cart'
import { getInventory, createOrder, initiatePayment, type CustomerInput } from '@/lib/middleware'
import { db, ensureSchema } from '@/lib/db'
import { apiError, ValidationError } from '@/lib/api'

const PAYMENT_METHODS = ['qris', 'va', 'ewallet', 'card']

/**
 * POST /api/v1/checkout
 * Body: { customer: CustomerInput, paymentMethod?: 'qris'|'va'|'ewallet'|'card' }
 * Cart comes from the caller's cookie (server-side DB read); prices come from
 * the middleware. Optionally initiates payment and returns its instructions.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const customer = validateCustomer(body?.customer)
    const paymentMethod = body?.paymentMethod
    if (paymentMethod !== undefined && !PAYMENT_METHODS.includes(paymentMethod))
      throw new ValidationError('"paymentMethod" must be qris|va|ewallet|card')

    const cart = await findCart()
    if (!cart || !cart.items.length) throw new ValidationError('Cart is empty')

    // Fresh stock check before hitting the middleware (which re-checks too).
    const { items: inv } = await getInventory(cart.items.map((i) => i.sku))
    const invBy = new Map(inv.map((i) => [i.sku, i.freeQty]))
    const short = cart.items
      .filter((i) => i.qty > (invBy.get(i.sku) ?? 0))
      .map((i) => ({ sku: i.sku, requested: i.qty, freeQty: invBy.get(i.sku) ?? 0 }))
    if (short.length) {
      return NextResponse.json({ error: { code: 'OUT_OF_STOCK', message: 'Insufficient stock', retryable: false, details: short } }, { status: 409 })
    }

    // Stable across retries of the same cart+email → safe middleware replay.
    const idemKey = 'co-' + createHash('sha256')
      .update(cart.id + customer.email + JSON.stringify(cart.items))
      .digest('hex')

    const { order } = await createOrder({ customer, items: cart.items }, idemKey)

    await ensureSchema()
    await db.insertInto('orders')
      .values({ middleware_order_id: order.id, cart_id: cart.id, customer_email: customer.email, payment_id: null, created_at: new Date().toISOString() })
      .execute()
    await markCartConverted(cart.id)
    await clearCartCookie()

    let payment = null
    if (paymentMethod) {
      const res = await initiatePayment(order.id, paymentMethod, 'pay-' + idemKey)
      payment = res.payment
      await db.updateTable('orders').set({ payment_id: payment.id }).where('middleware_order_id', '=', order.id).execute()
    }

    return NextResponse.json({ order, payment }, { status: 201 })
  } catch (e) {
    return apiError(e)
  }
}

function validateCustomer(c: unknown): CustomerInput {
  if (!c || typeof c !== 'object') throw new ValidationError('"customer" object is required')
  const o = c as Record<string, unknown>
  const str = (k: string) => {
    if (typeof o[k] !== 'string' || !(o[k] as string).trim()) throw new ValidationError(`customer."${k}" is required`)
    return (o[k] as string).trim()
  }
  const a = o.address as Record<string, unknown> | undefined
  if (!a || typeof a !== 'object') throw new ValidationError('customer."address" is required')
  const astr = (k: string) => {
    if (typeof a[k] !== 'string' || !(a[k] as string).trim()) throw new ValidationError(`customer.address."${k}" is required`)
    return (a[k] as string).trim()
  }
  return {
    name: str('name'), email: str('email').toLowerCase(), phone: str('phone'),
    address: {
      line1: astr('line1'), line2: typeof a.line2 === 'string' ? a.line2 : '',
      city: astr('city'), province: astr('province'), postalCode: astr('postalCode'),
      country: typeof a.country === 'string' ? a.country : 'ID',
    },
  }
}
