import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Exercise the page's callbacks and rendered props without a browser. Each render
// reuses hook state; effects are disabled so refreshes are controlled by the test.
const harness = vi.hoisted(() => ({
  state: [] as unknown[],
  cursor: 0,
  client: { auth: { getUser: vi.fn() }, from: vi.fn() },
}))
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const slot = harness.cursor++
    if (!(slot in harness.state)) harness.state[slot] = initial
    return [harness.state[slot], (value: unknown) => { harness.state[slot] = value }]
  },
  useCallback: (callback: unknown) => callback,
  useEffect: () => {},
}))
vi.mock('@/utils/supabase/client', () => ({ createClient: () => harness.client }))
vi.mock('@/app/dashboard/components/market-overview', () => ({ default: () => null }))
vi.mock('@/app/dashboard/components/trading-insights', () => ({ default: () => null }))
vi.mock('@/app/dashboard/components/active-positions', () => ({ default: () => null }))
vi.mock('@/app/dashboard/components/paper-strategies', () => ({ default: () => null }))
vi.mock('@/components/logs-table', () => ({ default: () => null }))
vi.mock('@/components/trades-table', () => ({ default: () => null }))

import DashboardPage from '@/app/dashboard/page'
import TradesTable from '@/components/trades-table'
import ActivePositions from '@/app/dashboard/components/active-positions'
import { StatsCard } from '@/components/dashboard/stats-card'

type Element = React.ReactElement<Record<string, unknown>>
function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!React.isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as React.ReactNode)]
}

const realTrade = {
  id: 'real-1', bot_id: 'bot-1', bots: { name: 'Live bot' }, symbol: 'BTC/USDT',
  side: 'buy', status: 'open', size: 1, price: 100, pnl: 12,
  external_id: 'exchange-1', created_at: new Date().toISOString(),
}

function query(result: unknown, rejects = false) {
  const builder = {
    select: () => builder, eq: () => builder, order: () => builder,
    limit: () => rejects ? Promise.reject(result) : Promise.resolve(result),
  }
  return builder
}

function mountContent() {
  harness.state = [new Map([['bot-1', 'Live bot']]), null]
  const content = DashboardPage() as React.ReactElement<{ botNames: Map<string, string> }>
  const Component = content.type as (props: typeof content.props) => React.ReactNode
  harness.state = []
  return () => {
    harness.cursor = 0
    return elements(Component(content.props))
  }
}

function tradeProps(tree: Element[]) {
  return tree.find(node => node.type === TradesTable)!.props as unknown as React.ComponentProps<typeof TradesTable>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('React', React)
  harness.cursor = 0
  harness.client.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
})

describe('dashboard paper logs are best effort', () => {
  it.each(['query error', 'rejected request'])('keeps real trades, KPIs and positions after a paper %s, then clears the notice on retry', async (failure) => {
    harness.client.from.mockImplementation((table: string) => table === 'trades'
      ? query({ data: [realTrade], error: null })
      : query(failure === 'query error' ? { data: null, error: { message: 'unavailable' } } : new Error('unavailable'), failure === 'rejected request'))
    const render = mountContent()
    await tradeProps(render()).onRefresh!()
    const tree = render()
    const props = tradeProps(tree)
    expect(props.error).toBeNull()
    expect(props.isLoading).toBe(false)
    expect(props.trades).toEqual([expect.objectContaining({ id: 'real-1', pnl: 12, simulated: false })])
    expect(tree.find(node => node.type === StatsCard && node.props.title === 'Live P&L (24h)')!.props.value).toBe('$12.00')
    expect(tree.find(node => node.type === StatsCard && node.props.title === 'Open live positions')!.props.value).toBe('1')
    expect(tree.find(node => node.type === ActivePositions)!.props).toMatchObject({ trades: props.trades, error: null, loading: false })
    expect(tree.find(node => node.props.role === 'status')!.props.children).toContain('Paper trades could not load')

    harness.client.from.mockImplementation((table: string) => query({ data: table === 'trades' ? [realTrade] : [{
      id: 'log-1', bot_id: 'bot-1', timestamp: realTrade.created_at,
      details: { trade: { ...realTrade, id: 'sim-1' } },
    }], error: null }))
    await props.onRefresh!()
    const recovered = render()
    expect(recovered.some(node => node.props.role === 'status')).toBe(false)
    expect(tradeProps(recovered).trades).toHaveLength(2)
    expect(tradeProps(recovered).trades[1]).toMatchObject({ id: 'sim-1', simulated: true })
  })

  it('still reports a real-trade fetch failure as blocking', async () => {
    harness.client.from.mockReturnValue(query({ data: null, error: { message: 'unavailable' } }))
    const render = mountContent()
    await tradeProps(render()).onRefresh!()
    const tree = render()
    expect(tradeProps(tree).error).toBeTruthy()
    expect(tradeProps(tree).trades).toEqual([])
    expect(tree.find(node => node.type === StatsCard && node.props.title === 'Live P&L (24h)')!.props.value).toBe('—')
    expect(harness.client.from).toHaveBeenCalledTimes(1)
  })
})
