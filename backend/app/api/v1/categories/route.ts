import { NextResponse } from 'next/server'
import { getCategories } from '@/lib/middleware'
import { apiError } from '@/lib/api'

export async function GET() {
  try {
    return NextResponse.json(await getCategories(), {
      headers: { 'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (e) {
    return apiError(e)
  }
}
