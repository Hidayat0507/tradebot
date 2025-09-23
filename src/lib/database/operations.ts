// @ts-nocheck
import { supabase } from './client';
import type { Trade } from '@/types';
import type { Database } from './schema';

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

type TradeInsert = Database['public']['Tables']['trades']['Insert'];
type BotInsert = Database['public']['Tables']['bots']['Insert'];

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

export async function saveTrade(
  trade: TradeInsert
): Promise<void> {
  const client = supabase as unknown as import('@supabase/supabase-js').SupabaseClient<any>
  const { error } = await client
    .from('trades')
    .insert(trade as any)

  if (error) {
    throw new DatabaseError(`Failed to save trade: ${error.message}`)
  }
}

export async function updateTradeStatus(
  tradeId: string,
  status: Trade['status'],
  pnl?: number
): Promise<void> {
  const updates: Partial<Trade> = { status }
  if (typeof pnl === 'number') {
    updates.pnl = pnl
  }

  const client = supabase as unknown as import('@supabase/supabase-js').SupabaseClient<any>
  const { error } = await client
    .from('trades')
    .update(updates as any)
    .eq('id', tradeId)

  if (error) {
    throw new DatabaseError(`Failed to update trade status: ${error.message}`)
  }
}

export async function toggleBot(botId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('bots')
    .update({ enabled })
    .eq('id', botId)

  if (error) throw new DatabaseError(`Failed to toggle bot: ${error.message}`)
}
