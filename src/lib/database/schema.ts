// Base types that represent our database enums
export type SupportedExchange = 'binance' | 'hyperliquid'
export type TradeSide = 'BUY' | 'SELL'
export type TradeStatus = 'OPEN' | 'CLOSED' | 'CANCELLED'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      bots: {
        Row: {
          id: string
          user_id: string
          name: string
          exchange: string
          pair: string
          max_position_size: number
          stoploss_percentage?: number
          enabled: boolean
          api_key: string
          api_secret: string
          webhook_secret: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          exchange: string
          pair: string
          max_position_size: number
          stoploss_percentage?: number
          enabled: boolean
          api_key: string
          api_secret: string
          webhook_secret: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          exchange?: string
          pair?: string
          max_position_size?: number
          stoploss_percentage?: number
          enabled?: boolean
          api_key?: string
          api_secret?: string
          webhook_secret?: string
          created_at?: string
          updated_at?: string
        }
      }
      trades: {
        Row: {
          id: string
          user_id: string
          external_id: string
          bot_id: string
          symbol: string
          side: string
          status: string
          size: number
          price: number | null
          pnl: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          external_id: string
          bot_id: string
          symbol: string
          side: string
          status: string
          size: number
          price?: number | null
          pnl?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          external_id?: string
          bot_id?: string
          symbol?: string
          side?: string
          status?: string
          size?: number
          price?: number | null
          pnl?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      exchange_config: {
        Row: {
          id: string
          user_id: string
          exchange: string
          api_key: string
          api_secret: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exchange: string
          api_key: string
          api_secret: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          exchange?: string
          api_key?: string
          api_secret?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      trade_side: TradeSide
      trade_status: TradeStatus
      supported_exchange: SupportedExchange
    }
  }
}
