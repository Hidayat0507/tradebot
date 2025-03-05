import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { toggleBot } from '@/lib/database/operations'

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const supabase = createServerComponentClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: bot } = await supabase
      .from('bots')
      .select('enabled')
      .eq('id', id)
      .single()

    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      )
    }

    await toggleBot(id, !bot.enabled)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to toggle bot:', error)
    return NextResponse.json(
      { error: 'Failed to toggle bot' },
      { status: 500 }
    )
  }
}
