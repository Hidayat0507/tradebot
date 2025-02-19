import { NextResponse } from 'next/server'
import { supabase } from '@/lib/database/client'
import type { SupportedExchange } from '@/types'

interface SettingsPayload {
  exchange: SupportedExchange
  apiKey: string
  apiSecret: string
  tradingEnabled: boolean
}

export async function GET() {
  console.log('Starting GET request to /api/settings');
  
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('Supabase environment variables are not configured');
    }

    const { data, error } = await supabase
      .from('exchange_config')
      .select('*')
      .eq('user_id', 'default_user')
      .single();

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Server error:', err);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  console.log('Starting POST request to /api/settings');
  
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('Supabase environment variables are not configured');
    }

    const payload: SettingsPayload = await request.json();

    // Basic validation
    if (!payload.exchange || !payload.apiKey || !payload.apiSecret) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('exchange_config')
      .upsert({
        exchange: payload.exchange,
        api_key: payload.apiKey,
        api_secret: payload.apiSecret,
        trading_enabled: payload.tradingEnabled,
        user_id: 'default_user'
      });

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Server error:', err);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      },
      { status: 500 }
    );
  }
}
