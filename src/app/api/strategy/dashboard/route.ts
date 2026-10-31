import { NextRequest } from 'next/server'
import { getAuthenticatedUser, handleApiError, successResponse, ApiError } from '@/app/api/_middleware/api-handler'
import { computePaperPnl, strategyHealth, type PaperTradeRow, type StrategyStatusRow } from '@/lib/strategy/dashboard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Strategy status per bot + paper trades + paper PnL for the signed-in user (RLS-scoped). */
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const [strategies, trades] = await Promise.all([
      supabase
        .from('bot_strategies')
        .select('bot_id, name, enabled, timeframe, last_candle_time, last_signal_at, last_signal, bots(name, pair)')
        .eq('user_id', user.id),
      supabase
        .from('trades')
        .select('id, bot_id, symbol, side, size, price, pnl, external_id, created_at')
        .eq('user_id', user.id)
        .like('external_id', 'paper-%')
        .order('created_at', { ascending: false })
        .limit(500),
    ])
    if (strategies.error || trades.error) throw new ApiError('Failed to load paper dashboard', 500)
    const now = Date.now()
    const rows = (trades.data ?? []) as PaperTradeRow[]
    return successResponse({
      mode: 'paper',
      strategies: ((strategies.data ?? []) as unknown as StrategyStatusRow[]).map((s) => ({ ...s, health: strategyHealth(s, now) })),
      trades: rows.slice(0, 100),
      pnl: computePaperPnl(rows),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
