import type { TradingViewSignal } from '@/types';
import { ApiError } from '../api-handler';
import { logger } from '@/lib/logging';

/**
 * Save trade to database
 */
export async function saveTrade(
  supabase: any,
  userId: string,
  botId: string,
  order: any,
  alert: TradingViewSignal,
  price: number,
  calculatedAmount?: number  // Add calculated amount as backup
) {
  const trade = {
    user_id: userId,
    external_id: order.id,
    bot_id: botId,
    symbol: alert.symbol,
    side: alert.action.toLowerCase(),
    status: 'filled',
    size: order.amount || calculatedAmount,  // Use calculated amount as fallback
    price: order.price || order.average || price,
    pnl: null
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
    logger.error('Failed to save trade', { error, botId, symbol: alert.symbol });
    
    // For debugging purposes, let's log more details about the RLS issue
    if (error.message.includes('row-level security')) {
      logger.error('RLS policy violation details', { 
        userId, 
        supabaseAuthUserId: supabase.auth?.user?.()?.id,
        tradeUserId: trade.user_id
      });
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