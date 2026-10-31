import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthenticatedUser, handleApiError } from '@/app/api/_middleware/api-handler'
import { runPreview } from '@/lib/strategy/preview'

export const runtime = 'nodejs'

/** Paste Pine → convert → paper backtest. No orders, no DB writes, public market data only. */
export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    const body = await request.json().catch(() => null)
    const result = await runPreview(body)
    return NextResponse.json(result, { status: result.ok ? 200 : 422 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid request', issues: error.issues.slice(0, 5) }, { status: 400 })
    }
    return handleApiError(error)
  }
}
