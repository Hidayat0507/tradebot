import type { Database } from '@/lib/database/schema'
import type { SupportedExchange, TradeSide, TradeStatus } from '@/lib/database/schema'

// Re-export database types
export type Bot = Database['public']['Tables']['bots']['Row']
export type Trade = Database['public']['Tables']['trades']['Row']
export type ExchangeConfig = Database['public']['Tables']['exchange_configs']['Row']

// Re-export common types
export type { SupportedExchange, TradeSide, TradeStatus }

// Trading View specific types
export interface TradingViewSignal {
  bot_id: string;  // Required bot ID
  action: TradeSide;
  symbol: string;
  timestamp: string;  // Required ISO timestamp
  order_size: string;  // Required (e.g., "100%")
  position_size: number;  // Required position size
  price?: number;  // Optional price
  strategy?: string;  // Optional strategy name
  stoploss?: number;
  stoplossPercent?: number;
}

// Stats types
export interface BotStats {
  botId: string
  totalTrades: number
  winningTrades: number
  losingTrades: number
  totalPnL: number
  lastTradeAt?: Date
  updatedAt: Date
}

export interface BotPerformance {
  bot: Bot
  stats: BotStats
  recentTrades: Array<{
    timestamp: Date
    type: TradeSide
    price: number
    pnl?: number
  }>
}
