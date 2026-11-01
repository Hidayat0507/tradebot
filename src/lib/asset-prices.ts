/** USDT quotes are estimates of USD value; unquoted assets stay unavailable. */
export const STABLECOINS = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'USDD', 'TUSD', 'USDP'])

export async function fetchLivePrices(exchange: string, currencies: string[]): Promise<Record<string, number | null>> {
  const assets = [...new Set(currencies)]
  const prices: Record<string, number | null> = Object.fromEntries(assets.map(asset => [asset, null]))
  const quote = exchange.toLowerCase() === 'hyperliquid' ? 'USDC' : 'USDT'
  // The quote currency defines the estimate's unit; other stablecoins need a ticker too.
  const pending = assets.filter(asset => {
    if (asset.toUpperCase() !== quote) return true
    prices[asset] = 1
    return false
  })
  for (let offset = 0; offset < pending.length; offset += 24) {
    const batch = pending.slice(offset, offset + 24)
    try {
      const response = await fetch('/api/exchange/market', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange, symbols: batch.map(asset => `${asset}/${quote}`) }),
        signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) continue
      const payload = await response.json()
      if (!payload?.success || !Array.isArray(payload.data)) continue
      for (const row of payload.data) {
        const asset = batch.find(asset => row?.symbol === `${asset}/${quote}`)
        if (asset && !row.error && typeof row.last_price === 'number' && Number.isFinite(row.last_price) && row.last_price > 0) {
          prices[asset] = row.last_price
        }
      }
    } catch { /* Keep unavailable quotes null, including timeouts. */ }
  }
  return prices
}
