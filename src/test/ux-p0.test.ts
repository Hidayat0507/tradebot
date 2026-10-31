import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { secretDisplay, secretForExample } from '@/lib/webhook-secret-display'
import { buildAlertExample, webhookUrl, WEBHOOK_FIELDS } from '@/lib/webhook-example'
import { formatOrderSizePct, isPaperTradeId, modeOf, ORDER_SIZE } from '@/lib/bot-config'
import { validateWebhookAlert } from '@/app/api/_middleware/webhook/validate-webhook'

const src = (p: string) => readFileSync(path.resolve(__dirname, '../..', p), 'utf8')

describe('#1 webhook secret display', () => {
  it('never shows the stored hash; fresh plaintext shown once', () => {
    expect(secretDisplay('sha256:abc', null)).toEqual({ kind: 'hidden' })
    expect(secretDisplay('', null)).toEqual({ kind: 'missing' })
    expect(secretDisplay('sha256:abc', 'plain123')).toEqual({ kind: 'fresh', value: 'plain123' })
    expect(secretDisplay('sha256:abc', 'sha256:abc')).toEqual({ kind: 'hidden' })
    expect(secretForExample({ kind: 'hidden' })).toBe('YOUR_WEBHOOK_SECRET')
  })
  it('UI never renders bot.webhook_secret and bot pages do not select credentials', () => {
    const ui = src('src/components/bot/WebhookSecretSection.tsx')
    expect(ui).not.toMatch(/value=\{bot\.webhook_secret/)
    for (const f of ['src/app/bots/[id]/page.tsx', 'src/app/bots/page.tsx']) {
      expect(src(f)).not.toMatch(/select\('\*'\)/)
      expect(src(f)).not.toMatch(/api_key|api_secret/)
    }
    expect(src('src/app/bots/create/components/create-bot-form.tsx')).not.toMatch(/console\.log\('Sending request to validate API'/)
  })
})

describe('#2 alert example matches the real webhook contract', () => {
  it('generated example (with TradingView placeholders filled) passes validateWebhookAlert', () => {
    const ex = buildAlertExample({ origin: 'https://app.example', botId: 'b1', pair: 'BTC/USDT', secret: 's', orderSizePct: 25 })
    const filled = JSON.parse(JSON.stringify(ex).replace(/\{\{timenow\}\}/g, new Date().toISOString())
      .replace('{{strategy.order.action}}', 'BUY').replace('{{strategy.order.id}}', 'Long'))
    const v = validateWebhookAlert(filled)
    expect(v).toMatchObject({ bot_id: 'b1', symbol: 'BTC/USDT', action: 'buy', order_size: 25 })
  })
  it('lists every required field the server checks', () => {
    const required = WEBHOOK_FIELDS.filter((f) => f.required).map((f) => f.name).sort()
    expect(required).toEqual(['action', 'alert_id', 'bot_id', 'secret', 'symbol', 'ts'])
    for (const k of required) expect(buildAlertExample({ origin: '' })).toHaveProperty(k)
  })
  it('URL comes from the deployment origin; no hardcoded hosts remain', () => {
    expect(webhookUrl('https://x.example/')).toBe('https://x.example/api/webhook')
    const docs = src('src/app/bots/create/components/api-documentation.tsx') + src('src/components/bot/WebhookExample.tsx')
    expect(docs).not.toMatch(/signum\.money|your-site\.com|BTCUSDT|allow list/)
  })
})

describe('#3 order size has one meaning', () => {
  it('percent of balance everywhere', () => {
    expect(formatOrderSizePct(50)).toBe('50% of balance')
    expect(formatOrderSizePct('0.01')).toBe('0.01% of balance')
    expect(formatOrderSizePct(null)).toBe('—')
    expect(src('src/app/bots/page.tsx')).not.toMatch(/\$\{bot\.max_position_size\}/)
    expect(src('src/app/bots/create/components/create-bot-form.tsx')).not.toMatch(/base currency/)
    expect(ORDER_SIZE.max).toBe(100)
  })
  it('webhook rejects order_size above 100%', () => {
    const base = { bot_id: 'b', symbol: 'BTC/USDT', action: 'buy', secret: 's', ts: new Date().toISOString(), alert_id: 'a' }
    expect(() => validateWebhookAlert({ ...base, order_size: 150 })).toThrow(/between 0 and 100/)
    expect(validateWebhookAlert({ ...base, order_size: 100 }).order_size).toBe(100)
  })
})

describe('#4 mode helpers', () => {
  it('mode + paper trade detection', () => {
    expect(modeOf({ mode: 'paper' })).toBe('paper')
    expect(modeOf({})).toBe('live')
    expect(isPaperTradeId('paper-abc')).toBe(true)
    expect(isPaperTradeId('123')).toBe(false)
  })
})
