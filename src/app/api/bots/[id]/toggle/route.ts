import { NextResponse } from 'next/server'
import { supabase } from '@/lib/database/client'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // First get the current bot state
    const { data: bot, error: fetchError } = await supabase
      .from('bots')
      .select('enabled')
      .eq('id', params.id)
      .single()

    if (fetchError) throw fetchError
    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      )
    }

    // Toggle the enabled state
    const { data, error } = await supabase
      .from('bots')
      .update({
        enabled: !bot.enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    // Here you would typically also start/stop the actual trading process
    // TODO: Implement actual trading start/stop logic
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error toggling bot:', error)
    return NextResponse.json(
      { error: 'Failed to toggle bot' },
      { status: 500 }
    )
  }
}
