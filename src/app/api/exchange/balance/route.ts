import { NextResponse } from 'next/server'
import { createExchangeClient } from '@/app/api/_middleware/exchange';
import { handleApiError } from '@/app/api/_middleware/error-handler';
import { createApiResponse } from '@/app/api/_middleware/response';
import { createClient } from '@/utils/supabase/server';

interface CurrencyBalance {
  free: number;
  used: number;
  total: number;
}

interface ExchangeBalance {
  free?: number;
  used?: number;
  total?: number;
}

export async function GET() {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get exchange client with user ID
    const exchange = await createExchangeClient(user.id);

    // Fetch balance
    const balance = await exchange.fetchBalance();
    
    // Filter and format balances
    const formattedBalance: Record<string, CurrencyBalance> = {};
    
    // Process each currency in the balance
    for (const [currency, data] of Object.entries(balance)) {
      const balanceData = data as ExchangeBalance;
      if (balanceData && typeof balanceData.total === 'number' && balanceData.total > 0) {
        formattedBalance[currency] = {
          total: balanceData.total,
          free: typeof balanceData.free === 'number' ? balanceData.free : 0,
          used: typeof balanceData.used === 'number' ? balanceData.used : 0
        };
      }
    }

    return NextResponse.json(formattedBalance);
  } catch (error) {
    console.error('Balance fetch error:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.name === 'ExchangeError' ? 400 : 500 }
      );
    }
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
