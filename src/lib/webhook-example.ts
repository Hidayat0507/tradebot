import { ORDER_SIZE } from './bot-config'

/**
 * Builds the TradingView alert example from the real webhook contract
 * (validateWebhookAlert: bot_id, symbol, action, secret, ts, alert_id required; order_size optional).
 * Single source of truth for the create page and the bot detail page.
 */
export interface WebhookExampleInput {
  origin: string
  botId?: string
  pair?: string
  secret?: string
  orderSizePct?: number
}

export const WEBHOOK_PATH = '/api/webhook'

export const WEBHOOK_FIELDS: { name: string; required: boolean; description: string }[] = [
  { name: 'bot_id', required: true, description: 'Your bot ID.' },
  { name: 'secret', required: true, description: 'Your webhook secret (shown once when generated).' },
  { name: 'symbol', required: true, description: 'Must equal the bot pair exactly, e.g. BTC/USDT.' },
  { name: 'action', required: true, description: '"buy" or "sell". Use {{strategy.order.action}}.' },
  { name: 'ts', required: true, description: 'Alert time. Use {{timenow}}; alerts older than 60s are rejected.' },
  { name: 'alert_id', required: true, description: 'Unique per alert; duplicates are ignored.' },
  { name: 'order_size', required: false, description: `Percent of balance (${ORDER_SIZE.min}–${ORDER_SIZE.max}). Defaults to the bot's order size.` },
]

export function webhookUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}${WEBHOOK_PATH}`
}

export function buildAlertExample(i: WebhookExampleInput): Record<string, string | number> {
  return {
    bot_id: i.botId ?? '<your-bot-id>',
    secret: i.secret ?? 'YOUR_WEBHOOK_SECRET',
    symbol: i.pair ?? 'BTC/USDT',
    action: '{{strategy.order.action}}',
    ts: '{{timenow}}',
    alert_id: '{{strategy.order.id}}-{{timenow}}',
    ...(i.orderSizePct ? { order_size: i.orderSizePct } : {}),
  }
}

export function buildAlertExampleJson(i: WebhookExampleInput): string {
  return JSON.stringify(buildAlertExample(i), null, 2)
}

/** Browser origin, falling back to NEXT_PUBLIC_SITE_URL (no hardcoded hosts). */
export function currentOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_SITE_URL || ''
}
