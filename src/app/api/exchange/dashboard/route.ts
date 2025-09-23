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
// We use a narrowed ExchangeClient interface elsewhere; for optional features, guard at runtime

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
          apiSecret: bot.api_secret,
          password: (bot as any).password || undefined
        };

        // Await the exchange client creation
        const exchange = await createExchangeClient(bot.exchange, credentials);

        // Fetch positions if supported by the client
        const positions = typeof (exchange as any).fetchPositions === 'function'
          ? await (exchange as any).fetchPositions()
          : [];
        dashboardData.positions.push(...positions.map((pos: any) => ({
          ...pos,
          botId: bot.id,
          botName: bot.name
        })));
        dashboardData.totalPositions += positions.length;

        // Bitget: Add custom PnL logic here if needed

        // Fetch trades if supported by the client
        const trades = typeof (exchange as any).fetchMyTrades === 'function'
          ? await (exchange as any).fetchMyTrades(undefined, undefined, 10)
          : [];
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
