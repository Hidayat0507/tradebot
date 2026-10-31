import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import path from 'path'
vi.mock('@/lib/logging', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, normalizeError: (e: unknown) => e }))
import { saveTrade, mapOrderStatus } from '@/app/api/_middleware/webhook/save-trade'
import type { TradingViewSignal } from '@/types'

function supabase(lastBuy: unknown = null) {
  const inserted: Record<string, unknown>[] = []
  const chain: Record<string, unknown> = {}
  Object.assign(chain, { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain,
    maybeSingle: async () => ({ data: lastBuy, error: null }),
    insert: (row: Record<string, unknown>) => { inserted.push(row); return { select: () => ({ single: async () => ({ data: row, error: null }) }) } } })
  return { client: { from: () => chain } as never, inserted }
}
const alert = (action = 'buy') => ({ bot_id: 'b', symbol: 'BTC/USDT', action, alert_id: 'a', ts: new Date().toISOString() }) as unknown as TradingViewSignal

describe('trade status from the real order', () => {
  it.each([['open', 'open'], ['closed', 'filled'], ['canceled', 'cancelled'], ['expired', 'cancelled'],
    ['rejected', 'failed'], [undefined, 'pending'], ['weird', 'pending']])('maps %s -> %s', (s, want) => {
    expect(mapOrderStatus(s as string | undefined)).toBe(want)
  })
  it('records an open, unfilled order as open with zero size, not filled', async () => {
    const { client, inserted } = supabase()
    await saveTrade(client, 'u', 'b', { id: 'o1', status: 'open', amount: 1, filled: 0, price: 100 } as never, alert(), 100, 1)
    expect(inserted[0]).toMatchObject({ status: 'open', size: 0 })
  })
  it('uses filled amount and average price from a partially filled order', async () => {
    const { client, inserted } = supabase()
    await saveTrade(client, 'u', 'b', { id: 'o2', status: 'closed', amount: 2, filled: 1.5, price: 100, average: 101 } as never, alert(), 99, 2)
    expect(inserted[0]).toMatchObject({ status: 'filled', size: 1.5, price: 101 })
  })
  it('computes sell pnl from executed size and average price', async () => {
    const { client, inserted } = supabase({ price: 100 })
    await saveTrade(client, 'u', 'b', { id: 'o3', status: 'closed', amount: 2, filled: 2, average: 110 } as never, alert('sell'), 105, 2)
    expect(inserted[0]).toMatchObject({ pnl: 20, price: 110 })
  })
  it('does not compute pnl for an unfilled sell', async () => {
    const { client, inserted } = supabase({ price: 100 })
    await saveTrade(client, 'u', 'b', { id: 'o4', status: 'canceled', amount: 2, filled: 0 } as never, alert('sell'), 105, 2)
    expect(inserted[0]).toMatchObject({ status: 'cancelled', pnl: null })
  })
})

describe('repo hygiene', () => {
  const root = path.resolve(__dirname, '../..')
  it('has a single npm lockfile', () => {
    expect(existsSync(path.join(root, 'package-lock.json'))).toBe(true)
    for (const f of ['bun.lockb', 'bun.lock', 'yarn.lock', 'pnpm-lock.yaml']) expect(existsSync(path.join(root, f))).toBe(false)
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
    expect(pkg.packageManager).toBeUndefined()
    expect(pkg.trustedDependencies).toBeUndefined()
  })
  it('docs do not tell people to use bun', () => {
    for (const f of ['README.md', 'docs/ADMIN_PANEL_GUIDE.md', 'scripts/README-BITGET-TEST.md']) {
      expect(readFileSync(path.join(root, f), 'utf8')).not.toMatch(/\bbun (run|install|scripts)/)
    }
  })
  it('never redirects to the non-existent /auth/login', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap(f => {
      const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
    const hits = walk(path.join(root, 'src')).filter(f => /\.(tsx?|jsx?)$/.test(f) && !f.includes('/test/'))
      .filter(f => readFileSync(f, 'utf8').includes('/auth/login'))
    expect(hits).toEqual([])
    expect(existsSync(path.join(root, 'src/app/auth/page.tsx'))).toBe(true)
  })
})
