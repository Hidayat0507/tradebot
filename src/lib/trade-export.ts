import type { TradeEntry } from '@/components/trades-table'

function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? '' : String(value)
  // Spreadsheet applications interpret these prefixes as formulas, even inside quotes.
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

/** Export every loaded row matching the current filter, not just the visible page. */
export function tradesCsv(trades: TradeEntry[]): string {
  const rows = trades.map(trade => [
    trade.id, trade.botName || trade.botId, trade.symbol, trade.side, trade.status,
    trade.paper || trade.simulated ? 'paper' : 'live', trade.size, trade.price,
    trade.pnl, trade.timestamp,
  ])
  return [
    ['Trade ID', 'Bot', 'Symbol', 'Side', 'Status', 'Mode', 'Size', 'Price', 'PnL', 'Time (ISO 8601)'],
    ...rows,
  ].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
