export interface CurrencyBalance {
  free?: number
  used?: number
  total?: number
  [key: string]: unknown
}

export type BalanceMap = Record<string, CurrencyBalance | undefined> & {
  total?: Record<string, number>
  free?: Record<string, number>
  used?: Record<string, number>
}

export interface OrderBookSideEntry extends Array<number> {
  0: number
  1: number
}

export interface OrderBookResult {
  bids: OrderBookSideEntry[]
  asks: OrderBookSideEntry[]
  [key: string]: unknown
}

export interface TickerResult {
  last?: number
  bid?: number
  ask?: number
  baseVolume?: number
  quoteVolume?: number
  percentage?: number
  high?: number
  low?: number
  average?: number
  [key: string]: unknown
}

export interface OrderResult {
  id: string
  amount?: number
  price?: number | null
  average?: number | null
  status?: string
  filled?: number
  remaining?: number
  [key: string]: unknown
}

export interface ExchangeClient {
  id: string
  apiKey?: string
  walletAddress?: string
  options?: Record<string, unknown>
  has?: Record<string, unknown>
  fetchBalance(params?: Record<string, unknown>): Promise<BalanceMap>
  fetchMarkets(): Promise<Array<{ symbol?: string; limits?: unknown; precision?: unknown }>>
  fetchOrderBook(symbol: string): Promise<OrderBookResult>
  fetchTicker(symbol: string): Promise<TickerResult>
  fetchOHLCV(symbol: string, timeframe?: string, since?: number, limit?: number): Promise<number[][]>
  createOrder(
    symbol: string,
    type: string,
    side: string,
    amount: number,
    price?: number | null,
    params?: Record<string, unknown>
  ): Promise<OrderResult>
  loadMarkets(): Promise<void>
}
