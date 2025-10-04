import type { TradingViewSignal } from '@/types';
import { ApiError } from '../api-handler';
import { logger, normalizeError } from '@/lib/logging';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderResult } from '@/types/exchange';
import type { Database } from '@/lib/database/schema';

/**
 * Save trade to database
 */
export async function saveTrade(
  supabase: SupabaseClient<Database>,
  userId: string,
  botId: string,
  order: OrderResult,
  alert: TradingViewSignal,
  price: number,
  calculatedAmount?: number  // Add calculated amount as backup
) {
  type TradeSummary = Pick<Database['public']['Tables']['trades']['Row'], 'price' | 'size'>
  let pnl = null;
  // If this is a sell order, calculate PnL from the most recent buy trade
  if (alert.action.toLowerCase() === 'sell') {
    // Fetch the most recent buy trade for this bot and symbol
    const { data: lastBuyTrade, error: fetchError } = await supabase
      .from('trades')
      .select<'price, size', TradeSummary>('price, size')
      .eq('bot_id', botId)
      .eq('symbol', alert.symbol)
      .eq('side', 'buy')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!fetchError && lastBuyTrade && typeof lastBuyTrade.price === 'number') {
      // Calculate PnL: (Sell Price - Buy Price) * Sell Size
      const sellPrice = order.price || order.average || price;
      const buyPrice = lastBuyTrade.price;
      const sellSize = order.amount ?? calculatedAmount ?? 0;
      pnl = (sellPrice - buyPrice) * sellSize;
    }
  }

  const trade = {
    user_id: userId,
    external_id: order.id,
    bot_id: botId,
    symbol: alert.symbol,
    side: alert.action.toLowerCase(),
    status: 'filled',
    size: order.amount ?? calculatedAmount ?? 0,  // Use calculated amount as fallback
    price: order.price || order.average || price,
    pnl: pnl
  };

  logger.info('Saving trade to database', { 
    trade,
    botId,
    userId,
    orderAmount: order.amount,
    calculatedAmount
  });

  // Insert trade into database
  const { data, error } = await supabase
    .from('trades')
    .insert(trade)
    .select()
    .single();

  if (error) {
    const err = normalizeError(error)
    logger.error('Failed to save trade', err, { botId, symbol: alert.symbol });
    
    // For debugging purposes, let's log more details about the RLS issue
    if (error.message.includes('row-level security')) {
      logger.error(
        'RLS policy violation details',
        new Error('Row-level security violation'),
        {
          userId,
          tradeUserId: trade.user_id,
        }
      );
    }
    
    throw new ApiError(`Failed to save trade: ${error.message}`, 500);
  }

  logger.info('Trade saved successfully', {
    tradeId: data.id,
    botId,
    symbol: alert.symbol
  });

  return data;
} 
