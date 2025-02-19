import { NextResponse } from 'next/server'
import { supabase } from '@/lib/database/client'
import type { Database } from '@/lib/database/schema'

type BotInsert = Database['public']['Tables']['bots']['Insert']

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('bots')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching bots:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bots' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()

    // Basic validation
    if (!payload.name || !payload.pair || !payload.max_position_size) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const botData: BotInsert = {
      name: payload.name,
      pair: payload.pair,
      max_position_size: payload.max_position_size,
      stoploss_percentage: payload.stoploss_percentage,
      enabled: false,
      webhook_secret: payload.webhook_secret,
      user_id: 'default_user', // Replace with actual user ID from auth
      exchange: payload.exchange || 'binance'
    }

    const { data, error } = await supabase
      .from('bots')
      .insert(botData)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error creating bot:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create bot' },
      { status: 500 }
    )
  }
}
