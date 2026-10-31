import { randomUUID } from 'crypto';
import type { TradingViewSignal } from '@/types';
import { ApiError } from '../api-handler';
import type { ExchangeClient, OrderResult } from '@/types/exchange';

export interface BotData {
  id: string;
  exchange: string;
  api_key: string;
  api_secret: string;
  user_id: string;
  webhook_secret: string;
  pair: string;
  order_size?: number;
  max_position_size?: number;
  mode?: 'paper' | 'live';
  name: string;
  password?: string;
}

export function isPaperMode(bot: BotData): boolean {
  return bot.mode === 'paper' || process.env.TRADING_MODE === 'paper' ||
    (process.env.NODE_ENV === 'test' && process.env.TRADING_MODE !== 'live');
}

export function validateOrderSafety(alert: TradingViewSignal, bot: BotData): void {
  if (!bot.pair || alert.symbol !== bot.pair) {
    throw new ApiError('Alert symbol must match the configured bot pair', 400);
  }
  if (bot.max_position_size !== undefined &&
    (!Number.isFinite(bot.max_position_size) || bot.max_position_size <= 0)) {
    throw new ApiError('Invalid maximum position size in base currency', 400);
  }
  for (const size of [bot.order_size, alert.order_size]) {
    if (size !== undefined && (!Number.isFinite(size) || size <= 0 || size > 100)) {
      throw new ApiError('Order size must be greater than 0 and at most 100 percent', 400);
    }
  }
}

/** Price is the independently fetched ticker price, never an alert price. */
export async function executeTrade(
  exchange: ExchangeClient,
  alert: TradingViewSignal,
  price: number,
  bot: BotData
): Promise<{ order: OrderResult; calculatedAmount: number }> {
  validateOrderSafety(alert, bot);
  if (!Number.isFinite(price) || price <= 0) throw new ApiError('Invalid ticker price', 400);
  if (alert.price !== undefined && (!Number.isFinite(alert.price) || alert.price <= 0 ||
    Math.abs(alert.price - price) / price > 0.02)) {
    throw new ApiError('Alert price deviates more than 2% from ticker', 400);
  }
  // USD caps require a USD quoted market; reject unsupported conversions rather than guessing.
  const [base, quote] = bot.pair.split(':')[0].split('/');
  if (!['USD', 'USDT', 'USDC'].includes(quote)) {
    throw new ApiError('Order safety requires a USD quoted pair', 400);
  }
  const envCap = process.env.MAX_ORDER_NOTIONAL_USD === undefined
    ? 100 : Number(process.env.MAX_ORDER_NOTIONAL_USD);
  const cap = envCap;
  if (!Number.isFinite(cap) || cap <= 0) throw new ApiError('Invalid max order notional USD', 400);
  const percentage = Math.min(bot.order_size ?? 5, alert.order_size ?? 100);
  const paper = isPaperMode(bot);
  const currency = alert.action === 'buy' ? quote : base;
  // Paper mode uses a simulated $1,000 portfolio and makes no private exchange calls.
  const balance = paper ? undefined : await exchange.fetchBalance({
    type: bot.pair.includes(':') ? 'swap' : 'spot',
    ...(bot.exchange.toLowerCase() === 'hyperliquid' ? { user: bot.api_key } : {})
  });
  const available = paper ? (alert.action === 'buy' ? 1000 : 1000 / price)
    : balance?.[currency]?.free;
  if (available === undefined || !Number.isFinite(available) || available <= 0) {
    throw new ApiError('No available balance for order', 400);
  }
  const executionPrice = alert.price ?? price;
  const valuationPrice = Math.max(price, executionPrice);
  const balanceAmount = available * percentage / 100 / (alert.action === 'buy' ? valuationPrice : 1);
  if (alert.amount !== undefined && (!Number.isFinite(alert.amount) || alert.amount <= 0)) {
    throw new ApiError('Invalid alert amount', 400);
  }
  // Limit buys are also bounded by their execution price.
  const amount = Math.min(balanceAmount, cap / valuationPrice, bot.max_position_size ?? Infinity, alert.amount ?? Infinity);
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError('Invalid order amount', 400);
  if (paper) {
    return { calculatedAmount: amount, order: {
      id: `paper-${randomUUID()}`, amount, filled: amount, remaining: 0,
      price: executionPrice, average: executionPrice, status: 'closed', paper: true
    } };
  }
  const hyperliquid = bot.exchange.toLowerCase() === 'hyperliquid';
  const order = await exchange.createOrder(bot.pair, alert.price === undefined ? 'market' : 'limit',
    alert.action, amount, alert.price ?? (hyperliquid || alert.action === 'buy' ? price : undefined),
    {
      ...(alert.stoplossPercent ? { stopLoss: {
        stopPrice: price * (1 - alert.stoplossPercent / 100), type: 'market'
      } } : {}),
      ...(hyperliquid ? { slippage: 0.01 } : {})
    });
  return { order, calculatedAmount: amount };
}
