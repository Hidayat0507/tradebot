/** Splits dashboard trades into live vs paper so headline numbers never mix simulated fills with real money. */
export interface ModeTrade { pnl: number | null; timestamp: string; paper?: boolean; simulated?: boolean }

export interface ModeTotals { pnl24h: number; pnlAll: number; trades: number }

export const isPaperEntry = (t: Pick<ModeTrade, 'paper' | 'simulated'>) => !!(t.paper || t.simulated)

export function splitByMode<T extends ModeTrade>(trades: T[], now = Date.now()): { live: ModeTotals; paper: ModeTotals; liveTrades: T[]; paperTrades: T[] } {
  const totals = (xs: T[]): ModeTotals => ({
    pnl24h: round(xs.filter((t) => t.pnl !== null && Date.parse(t.timestamp) > now - 86_400_000).reduce((a, t) => a + (t.pnl ?? 0), 0)),
    pnlAll: round(xs.reduce((a, t) => a + (t.pnl ?? 0), 0)),
    trades: xs.length,
  })
  const liveTrades = trades.filter((t) => !isPaperEntry(t))
  const paperTrades = trades.filter(isPaperEntry)
  return { live: totals(liveTrades), paper: totals(paperTrades), liveTrades, paperTrades }
}

const round = (v: number) => Math.round(v * 100) / 100
