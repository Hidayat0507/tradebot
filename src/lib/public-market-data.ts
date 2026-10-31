import { createExchangeClient, fetchMarketData } from '@/app/api/_middleware/exchange-middleware'
import { createMarketDataService } from '@/lib/market-data-service'

/** Process-wide singleton used by /api/exchange/market (public data only, never credentials). */
export const publicMarketData = createMarketDataService({
  createClient: (exchange) => createExchangeClient(exchange, undefined, 'market_data'),
  fetch: (client, symbol) => fetchMarketData(client, symbol),
  ttlMs: 30_000,
  maxConcurrent: 2,
})
