import { NextRequest, NextResponse } from 'next/server'
import { getBotWithOwnership, handleApiError, successResponse } from '@/app/api/_middleware/api-handler'
import { deleteBotStrategy, getBotStrategy, saveBotStrategy } from '@/lib/strategy/bot-strategy-store'
import type { SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, props: Ctx) {
  try {
    const { id } = await props.params
    const { supabase } = await getBotWithOwnership(request, id, 'id')
    return successResponse(await getBotStrategy(supabase as unknown as SupabaseClient, id))
  } catch (error) {
    return handleApiError(error)
  }
}

/** Save Pine for a bot (converted server-side). Paper only; enabled defaults to false. */
export async function PUT(request: NextRequest, props: Ctx) {
  try {
    const { id } = await props.params
    const { supabase, user } = await getBotWithOwnership(request, id, 'id')
    const body = await request.json().catch(() => null)
    const r = await saveBotStrategy(supabase as unknown as SupabaseClient, user.id, id, body)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    return successResponse(r.strategy)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, props: Ctx) {
  try {
    const { id } = await props.params
    const { supabase } = await getBotWithOwnership(request, id, 'id')
    await deleteBotStrategy(supabase as unknown as SupabaseClient, id)
    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
