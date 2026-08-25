import { NextResponse } from 'next/server'
import { getProduct } from '@/lib/middleware'
import { apiError } from '@/lib/api'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const { product } = await getProduct(slug)
    return NextResponse.json({ product }, {
      headers: { 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch (e) {
    return apiError(e)
  }
}
