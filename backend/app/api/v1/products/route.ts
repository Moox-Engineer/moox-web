import { NextRequest, NextResponse } from 'next/server'
import { getProducts } from '@/lib/middleware'
import { apiError } from '@/lib/api'

const PASS_THROUGH = ['category', 'q', 'featured', 'skus', 'page', 'perPage']

export async function GET(req: NextRequest) {
  try {
    const qs = new URLSearchParams()
    for (const key of PASS_THROUGH) {
      const v = req.nextUrl.searchParams.get(key)
      if (v) qs.set(key, v)
    }
    const data = await getProducts(qs.toString())
    return NextResponse.json(data, {
      headers: { 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch (e) {
    return apiError(e)
  }
}
