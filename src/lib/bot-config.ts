/**
 * Single meaning for `bots.max_position_size` everywhere in the UI and API:
 * the DEFAULT ORDER SIZE as a PERCENT OF AVAILABLE BALANCE (quote currency for buys,
 * base currency for sells), used when an alert does not send its own `order_size`.
 * (Column name kept for compatibility; see execute-trade.calculateTradeAmount.)
 */
export const ORDER_SIZE = {
  label: 'Default order size (% of balance)',
  shortLabel: 'Order size',
  help: 'Percent of your available balance used per order when the alert has no order_size. Buys use quote balance (e.g. USDT); sells use base balance (e.g. BTC).',
  min: 0.01,
  max: 100,
  default: 25,
} as const

export function formatOrderSizePct(v: number | string | null | undefined): string {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `${Number(n.toFixed(2))}% of balance`
}

export type BotMode = 'live' | 'paper' | 'testnet'
export const modeOf = (bot: { mode?: string | null }): BotMode =>
  bot.mode === 'paper' ? 'paper' : bot.mode === 'testnet' ? 'testnet' : 'live'
export const isPaperTradeId = (externalId: string | null | undefined) => !!externalId && externalId.startsWith('paper-')
