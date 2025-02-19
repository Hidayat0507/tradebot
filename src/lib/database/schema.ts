// Base types that represent our database enums
export type SupportedExchange = 'binance' | 'coinbase' | 'kraken'
export type TradeSide = 'BUY' | 'SELL'
export type TradeStatus = 'OPEN' | 'CLOSED' | 'CANCELLED'

export type Database = {
  public: {
    Tables: {
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
      trades: {
        Row: {
          id: string;
          external_id: string;
          user_id: string;
          symbol: string;
          side: TradeSide;
          entry_price: number;
          quantity: number;
          status: TradeStatus;
          strategy: string;
          pnl: number | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['trades']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['trades']['Insert']>;
      };
      exchange_configs: {
        Row: {
          id: string;
          user_id: string;
          exchange: SupportedExchange;
          api_key: string;
          api_secret: string;
          max_position_size: number;
          trading_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['exchange_configs']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['exchange_configs']['Insert']>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      trade_side: TradeSide;
      trade_status: TradeStatus;
      supported_exchange: SupportedExchange;
    };
  };
};
