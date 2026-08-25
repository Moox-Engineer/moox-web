import { NextRequest, NextResponse } from 'next/server'
import { getOrder } from '@/lib/middleware'
import { db, ensureSchema } from '@/lib/db'
import { apiError, ValidationError } from '@/lib/api'

/**
 * GET /api/v1/orders/{middlewareOrderId}?email=…
 * Guest order access: the local orders table maps middleware order IDs to the
 * customer email captured at checkout; a mismatched or unknown email is a 404
 * so order IDs can't be probed.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const email = req.nextUrl.searchParams.get('email')
    if (!email) throw new ValidationError('"email" query parameter is required')

    await ensureSchema()
    const local = await db
      .selectFrom('orders')
      .select(['customer_email'])
      .where('middleware_order_id', '=', id)
      .executeTakeFirst()
    if (!local || local.customer_email !== email.trim().toLowerCase())
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'No such order for this email', retryable: false } }, { status: 404 })

    return NextResponse.json(await getOrder(id))
  } catch (e) {
    return apiError(e)
  }
}
