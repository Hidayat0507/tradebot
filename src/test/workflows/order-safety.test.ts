import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/webhook/route';
import { createClient } from '@supabase/supabase-js';
import { processWebhookAlert } from '@/app/api/_middleware/webhook/process-webhook';
import type { BotData } from '@/app/api/_middleware/webhook/execute-trade';
import type { TradingViewSignal } from '@/types';

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(), fetchBalance: vi.fn(), fetchTicker: vi.fn(), insert: vi.fn(),
  single: vi.fn(), from: vi.fn(), botSingle: vi.fn(), select: vi.fn()
}));
vi.mock('ccxt', () => ({ bitget: class {
  id = 'bitget';
  fetchTicker = mocks.fetchTicker;
  fetchBalance = mocks.fetchBalance;
  createOrder = mocks.createOrder;
} }));
vi.mock('@/app/api/_middleware/exchange-middleware', async () => {
  const ccxt = await import('ccxt');
  return { createExchangeClient: vi.fn(() => new ccxt.bitget()), validateMarket: vi.fn(() => true) };
});
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from: mocks.from })) }));

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: mocks.from })),
  createServiceClient: vi.fn(() => ({ from: mocks.from }))
}));

const bot: BotData = { id: 'bot', name: 'test', user_id: 'user', exchange: 'bitget',
  api_key: 'fake', api_secret: 'fake', webhook_secret: 'fake', pair: 'BTC/USDT' };
const signal: TradingViewSignal = { bot_id: 'bot', symbol: 'BTC/USDT', action: 'buy' };
const run = (alert = signal, config = bot) => processWebhookAlert(alert, config, createClient('http://localhost', 'fake'));

describe('webhook server order safety', () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('TRADING_MODE', 'live');
    vi.stubEnv('MAX_ORDER_NOTIONAL_USD', '100');
    mocks.fetchTicker.mockResolvedValue({ last: 100 });
    mocks.fetchBalance.mockResolvedValue({ USDT: { free: 1000 }, BTC: { free: 10 } });
    mocks.createOrder.mockImplementation(async (_s, _t, _a, amount, price) => ({ id: 'mock', amount, price }));
    const query = { eq: vi.fn(), single: mocks.botSingle, order: vi.fn(), limit: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.botSingle.mockResolvedValue({ data: { ...bot, enabled: true, max_position_size: 0.01 }, error: null });
    mocks.from.mockReturnValue({ insert: mocks.insert, select: mocks.select });
    mocks.insert.mockReturnValue({ select: () => ({ single: mocks.single }) });
    mocks.single.mockResolvedValue({ data: { id: 'trade' }, error: null });
  });
  it('caps oversized alert amounts by USD notional', async () => {
    await run({ ...signal, amount: 100000 }, { ...bot, order_size: 100 });
    expect(mocks.createOrder.mock.calls[0][3]).toBe(1);
    expect(mocks.insert.mock.calls[0][0].size).toBe(1);
  });
  it('caps direct amounts by bot percentage despite alert sizing', async () => {
    await run({ ...signal, amount: 100000, order_size: 100 }, { ...bot, order_size: 1 });
    expect(mocks.createOrder.mock.calls[0][3]).toBe(0.1);
  });
  it('uses a small 5% default size', async () => {
    await run();
    expect(mocks.createOrder.mock.calls[0]).toEqual(['BTC/USDT', 'market', 'buy', 0.5, 100, {}]);
  });
  it('rejects the wrong pair before accessing an exchange', async () => {
    await expect(run({ ...signal, symbol: 'ETH/USDT' })).rejects.toThrow('configured bot pair');
    expect(mocks.fetchTicker).not.toHaveBeenCalled();
  });
  it.each([0, -1, 101, Infinity, NaN])('rejects invalid bot percentage %s', async size => {
    await expect(run(signal, { ...bot, order_size: size })).rejects.toThrow('Order size');
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });
  it('rejects oversized alert percentage', async () => {
    await expect(run({ ...signal, order_size: 101 })).rejects.toThrow('Order size');
  });
  it('rejects prices deviating over 2% from the fresh ticker', async () => {
    await expect(run({ ...signal, price: 103 })).rejects.toThrow('deviates');
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('caps limit notional using the higher execution price', async () => {
    await run({ ...signal, price: 102, amount: 999 }, { ...bot, order_size: 100 });
    expect(mocks.createOrder.mock.calls[0][3] * 102).toBeLessThanOrEqual(100);
  });
  it('defaults to a $100 cap when the environment cap is absent', async () => {
    vi.stubEnv('MAX_ORDER_NOTIONAL_USD', undefined);
    await run({ ...signal, amount: 999 }, { ...bot, order_size: 100 });
    expect(mocks.createOrder.mock.calls[0][3]).toBe(1);
  });
  it('defaults to paper mode in tests', async () => {
    vi.stubEnv('TRADING_MODE', undefined);
    await run();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.fetchBalance).not.toHaveBeenCalled();
  });
  it('respects a smaller environment USD cap', async () => {
    vi.stubEnv('MAX_ORDER_NOTIONAL_USD', '10');
    await run(signal);
    expect(mocks.createOrder.mock.calls[0][3]).toBe(0.1);
  });
  it('does not manufacture orders with no balance', async () => {
    mocks.fetchBalance.mockResolvedValue({ USDT: { free: 0 } });
    await expect(run()).rejects.toThrow('No available balance');
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });
  it.each(['bot', 'env'])('simulates paper fills via %s without private exchange calls', async mode => {
    if (mode === 'env') vi.stubEnv('TRADING_MODE', 'paper');
    await run(signal, mode === 'bot' ? { ...bot, mode: 'paper' } : bot);
    expect(mocks.fetchBalance).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.insert.mock.calls[0][0].external_id).toMatch(/^paper-/);
  });
  const post = (alert = signal) => POST(new NextRequest('http://localhost/api/webhook', {
    method: 'POST', body: JSON.stringify({ ...alert, secret: 'fake' })
  }));
  it.each([0.01, 2, 500])('POST preserves the absolute base cap %s', async cap => {
    mocks.botSingle.mockResolvedValue({ data: { ...bot, enabled: true, max_position_size: cap }, error: null });
    const response = await post({ ...signal, amount: 999999, order_size: 100 });
    expect(response.status).toBe(200);
    expect(mocks.createOrder.mock.calls[0][3]).toBe(Math.min(cap, 0.5));
    expect(mocks.select).toHaveBeenCalledWith(expect.stringContaining('max_position_size'));
  });
  it('POST rejects the wrong pair', async () => {
    expect((await post({ ...signal, symbol: 'ETH/USDT' })).status).toBe(400);
    expect(mocks.fetchTicker).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });
  it('POST rejects a price deviation', async () => {
    expect((await post({ ...signal, price: 103 })).status).toBe(400);
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });
  it('POST uses the small default percentage independently of the base cap', async () => {
    mocks.botSingle.mockResolvedValue({ data: { ...bot, max_position_size: 500 }, error: null });
    expect((await post()).status).toBe(200);
    expect(mocks.createOrder.mock.calls[0][3]).toBe(0.5);
  });
  it('POST caps sells using base balance, base cap and USD notional', async () => {
    mocks.botSingle.mockResolvedValue({ data: { ...bot, max_position_size: 0.2 }, error: null });
    mocks.fetchBalance.mockResolvedValue({ BTC: { free: 100 }, USDT: { free: 0 } });
    vi.stubEnv('MAX_ORDER_NOTIONAL_USD', '10');
    expect((await post({ ...signal, action: 'sell', amount: 999 })).status).toBe(200);
    expect(mocks.createOrder.mock.calls[0].slice(0, 5)).toEqual(['BTC/USDT', 'market', 'sell', 0.1, undefined]);
  });
  it('POST sizes sells as a percentage of base balance without dividing by price', async () => {
    mocks.botSingle.mockResolvedValue({ data: { ...bot, max_position_size: 500 }, error: null });
    mocks.fetchBalance.mockResolvedValue({ BTC: { free: 2 }, USDT: { free: 999999 } });
    expect((await post({ ...signal, action: 'sell' })).status).toBe(200);
    expect(mocks.createOrder.mock.calls[0][3]).toBe(0.1);
    expect(mocks.insert.mock.calls[0][0].size).toBe(0.1);
  });
  it.each([0, -1, Infinity, NaN])('rejects invalid absolute cap %s', async cap => {
    await expect(run(signal, { ...bot, max_position_size: cap })).rejects.toThrow('base currency');
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

});
