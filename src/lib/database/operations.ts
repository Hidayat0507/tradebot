import { supabase } from './client';
import type { Trade, ExchangeConfig } from '@/types';
import type { Database } from './schema';

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

type TradeInsert = Database['public']['Tables']['trades']['Insert'];
type ExchangeConfigInsert = Database['public']['Tables']['exchange_configs']['Insert'];

export async function getTrades(userId: string): Promise<Trade[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new DatabaseError('Database configuration missing');
  }

  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new DatabaseError(`Failed to get trades: ${error.message}`);
  return data || [];
}

export async function getExchangeConfig(userId: string): Promise<ExchangeConfig> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new DatabaseError('Database configuration missing');
  }

  const { data, error } = await supabase
    .from('exchange_configs')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new DatabaseError('No exchange configuration found');
    }
    throw new DatabaseError(`Failed to get exchange config: ${error.message}`);
  }

  return data;
}

export async function saveTrade(trade: Omit<Trade, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new DatabaseError('Database configuration missing');
  }

  const tradeData: TradeInsert = {
    external_id: trade.external_id,
    user_id: trade.user_id,
    symbol: trade.symbol,
    side: trade.side,
    entry_price: trade.entry_price,
    quantity: trade.quantity,
    status: trade.status,
    strategy: trade.strategy,
    pnl: trade.pnl,
    closed_at: trade.closed_at
  };

  const { error } = await supabase
    .from('trades')
    .insert([tradeData]);

  if (error) throw new DatabaseError(`Failed to save trade: ${error.message}`);
}

export async function updateTradeStatus(
  tradeId: string,
  status: Trade['status'],
  pnl?: number
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new DatabaseError('Database configuration missing');
  }

  const { error } = await supabase
    .from('trades')
    .update({
      status,
      pnl,
      closed_at: status === 'CLOSED' ? new Date().toISOString() : null
    })
    .eq('id', tradeId);

  if (error) throw new DatabaseError(`Failed to update trade status: ${error.message}`);
}

export async function saveExchangeConfig(
  config: Omit<ExchangeConfig, 'id' | 'created_at' | 'updated_at'>
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new DatabaseError('Database configuration missing');
  }

  const configData: ExchangeConfigInsert = {
    user_id: config.user_id,
    exchange: config.exchange,
    api_key: config.api_key,
    api_secret: config.api_secret,
    max_position_size: config.max_position_size,
    trading_enabled: config.trading_enabled
  };

  const { error } = await supabase
    .from('exchange_configs')
    .upsert([configData]);

  if (error) throw new DatabaseError(`Failed to save exchange config: ${error.message}`);
}
