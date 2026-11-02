import { NextRequest, NextResponse } from 'next/server'
import { getBotWithOwnership, handleApiError, successResponse } from '@/app/api/_middleware/api-handler'
import { deleteBotStrategy, getBotStrategy, saveBotStrategy } from '@/lib/strategy/bot-strategy-store'
import { createServiceClient } from '@/utils/supabase/server'
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

/** Save Pine for a bot (converted server-side). Paper by default; testnet requires reviewed opt-in. */
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

/** Explicit owner-only reset. Ordinary saves cannot clear server-owned guard state. */
export async function PATCH(request: NextRequest, props: Ctx) {
  try {
    const { id } = await props.params
    const { user } = await getBotWithOwnership(request, id, 'id')
    const body = await request.json().catch(() => null)
    if (body?.action !== 'clear-kill-switch') return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    const { data, error } = await createServiceClient().rpc('clear_strategy_kill_switch', { p_bot_id: id, p_user_id: user.id })
    if (error) return NextResponse.json({ error: 'Failed to clear kill switch' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Bot must be paper or testnet, with a matching testnet opt-in' }, { status: 400 })
    return successResponse({ cleared: true })
  } catch (error) {
    return handleApiError(error)
  }
}
