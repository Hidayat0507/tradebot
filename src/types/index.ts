import type { Database, SupportedExchange, TradeSide, TradeStatus } from '@/lib/database/schema'

// Re-export common types
export type { Database, SupportedExchange, TradeSide, TradeStatus } from '@/lib/database/schema'

// Database row types for convenience
export type Trade = Database['public']['Tables']['trades']['Row']
export type Bot = Database['public']['Tables']['bots']['Row'] & { 
  webhook_secret: string;
  order_size?: number; // Percentage of available balance to use (25, 50, 75, or 100)
}

// Trading View specific types
export interface TradingViewSignal {
  // Required fields
  bot_id: string
  symbol: string
  action: TradeSide
  
  // Optional fields
  price?: number        // Default: market price
  strategy?: string     // Default: ""
  stoplossPercent?: number  // Default: none
  amount?: number       // Optional direct amount for manual testing
  order_size?: number   // Optional percentage of available balance to use (25, 50, 75, or 100)
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
