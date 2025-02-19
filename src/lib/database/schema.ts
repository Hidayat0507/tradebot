// Base types that represent our database enums
export type SupportedExchange = 'binance' | 'coinbase' | 'kraken'
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
      bots: {
        Row: {
          id: string;
          name: string;
          user_id: string;
          exchange: SupportedExchange;
          pair: string;
          max_position_size: number;
          stoploss_percentage: number | null;
          enabled: boolean;
          webhook_secret: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['bots']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['bots']['Insert']>;
      };
    }
    Views: {
      [_ in never]: never;
    }
    Functions: {
      [_ in never]: never;
    }
    Enums: {
      trade_side: TradeSide;
      trade_status: TradeStatus;
      supported_exchange: SupportedExchange;
    };
  };
};
