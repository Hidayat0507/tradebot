import { NextRequest } from 'next/server';
import { ApiError } from '@/app/api/_middleware/api-handler';
import { 
  getAuthenticatedUser,
  handleApiError,
  successResponse
} from '@/app/api/_middleware/api-handler';
import {
  createExchangeClient,
  ExchangeCredentials
} from '@/app/api/_middleware/exchange-middleware';
import type { Exchange } from 'ccxt';

interface Position {
  botId: string;
  botName: string;
  [key: string]: any;
}

interface Trade {
  botId: string;
  botName: string;
  timestamp: number;
  [key: string]: any;
}

interface DashboardData {
  totalPositions: number;
  totalPnL: number;
  totalTrades: number;
  recentTrades: Trade[];
  positions: Position[];
  errors: any[];
}

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);

    const { data: bots, error: botsError } = await supabase
      .from('bots')
      .select('*')
      .eq('user_id', user.id);

    if (botsError) {
      throw new ApiError('Failed to fetch bots', 500);
    }

    const dashboardData: DashboardData = {
      totalPositions: 0,
      totalPnL: 0,
      totalTrades: 0,
      recentTrades: [],
      positions: [],
      errors: []
    };

    // Fetch data for each bot
    for (const bot of bots) {
      try {
        const credentials: ExchangeCredentials = {
          apiKey: bot.api_key,
          apiSecret: bot.api_secret
        };

        // Await the exchange client creation
        const exchange = await createExchangeClient(bot.exchange, credentials);

        // Fetch positions
        const positions = await (exchange as Exchange).fetchPositions();
        dashboardData.positions.push(...positions.map((pos: any) => ({
          ...pos,
          botId: bot.id,
          botName: bot.name
        })));
        dashboardData.totalPositions += positions.length;

        // Fetch PnL (last 24h) - Exchange specific
        if (bot.exchange === 'binance') {
          const pnl = await (exchange as any).fapiPrivateGetIncome({
            incomeType: 'REALIZED_PNL',
            startTime: Date.now() - 24 * 60 * 60 * 1000 // 24h ago
          });
          dashboardData.totalPnL += pnl.reduce((total: number, income: any) => 
            total + parseFloat(income.income), 0);
        }
        // Bitget: Add custom PnL logic here if needed

        // Fetch trades
        const trades = await (exchange as Exchange).fetchMyTrades(undefined, undefined, 10);
        dashboardData.recentTrades.push(...trades.map((trade: any) => ({
          ...trade,
          botId: bot.id,
          botName: bot.name
        })));
        dashboardData.totalTrades += trades.length;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error fetching data for bot ${bot.id}:`, message);
        dashboardData.errors.push({
          botId: bot.id,
          botName: bot.name,
          error: message
        });
      }
    }

    // Sort recent trades by timestamp
    dashboardData.recentTrades.sort((a, b) => b.timestamp - a.timestamp);
    // Limit to most recent 10 trades
    dashboardData.recentTrades = dashboardData.recentTrades.slice(0, 10);

    return successResponse(dashboardData);
  } catch (error) {
    return handleApiError(error);
  }
}
