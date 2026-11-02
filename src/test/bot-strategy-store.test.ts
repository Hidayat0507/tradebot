import { describe, expect, it } from 'vitest'
import { saveBotStrategy } from '@/lib/strategy/bot-strategy-store'
import { SAMPLE_PINE } from '@/lib/strategy/samples'

function fake(existing: boolean) {
  const calls: { op: string; args: unknown[] }[] = []
  const b: Record<string, unknown> = {}
  const chain = (op: string) => (...args: unknown[]) => { calls.push({ op, args }); return b }
  for (const op of ['select', 'eq', 'update', 'insert', 'delete']) b[op] = chain(op)
  b.maybeSingle = async () => ({ data: existing ? { bot_id: 'b1' } : null, error: null })
  b.single = async () => {
    const w = calls.find((c) => c.op === 'insert' || c.op === 'update')!
    return { data: { ...(w.args[0] as object), mode: 'paper' }, error: null }
  }
  return { client: { from: () => b } as never, calls }
}

describe('saveBotStrategy', () => {
  it('inserts with enabled=false by default and server-side definition', async () => {
    const { client, calls } = fake(false)
    const r = await saveBotStrategy(client, 'u1', 'b1', { pine: SAMPLE_PINE.emaCross, definition: { evil: true } })
    expect(r.ok).toBe(true)
    const ins = calls.find((c) => c.op === 'insert')!.args[0] as Record<string, unknown>
    expect(ins).toMatchObject({ bot_id: 'b1', user_id: 'u1', enabled: false, timeframe: '1h', paper_quote_size: 100, converter: 'parser', name: 'EMA Cross' })
    expect((ins.definition as { rules: unknown[] }).rules).toHaveLength(2)
    expect(ins).not.toHaveProperty('mode')
    expect(ins).not.toHaveProperty('last_candle_time')
  })
  it('updates existing row only with user-editable columns', async () => {
    const { client, calls } = fake(true)
    await saveBotStrategy(client, 'u1', 'b1', { pine: SAMPLE_PINE.rsi, enabled: true, timeframe: '4h' })
    const upd = calls.find((c) => c.op === 'update')!.args[0] as Record<string, unknown>
    expect(Object.keys(upd).sort()).toEqual(['allow_testnet', 'converter', 'definition', 'enabled', 'max_orders_per_day', 'name', 'paper_quote_size', 'pine_source', 'timeframe'])
    expect(upd.enabled).toBe(true)
    expect(calls.some((c) => c.op === 'insert')).toBe(false)
  })
  it('rejects unsupported Pine (422) and bad input (400) without writing', async () => {
    const { client, calls } = fake(false)
    expect(await saveBotStrategy(client, 'u', 'b', { pine: 'strategy("x")\nx = ta.vwap(close)' })).toMatchObject({ ok: false, status: 422 })
    expect(await saveBotStrategy(client, 'u', 'b', { pine: 'x', timeframe: '2h' })).toMatchObject({ ok: false, status: 400 })
    expect(await saveBotStrategy(client, 'u', 'b', { pine: 'x', paperQuoteSize: -1 })).toMatchObject({ ok: false, status: 400 })
    expect(calls.some((c) => c.op === 'insert' || c.op === 'update')).toBe(false)
  })
})
