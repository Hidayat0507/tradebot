import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/client'
import { BotFormValues } from '@/lib/validations/bot'

// GET /api/bots/[id] - Get a specific bot's details
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('bots')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch bot' },
      { status: 500 }
    )
  }
}

// PATCH /api/bots/[id] - Update a bot's settings
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const body = await request.json() as BotFormValues
    const { error } = await supabase
      .from('bots')
      .update(body)
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update bot' },
      { status: 500 }
    )
  }
}

// DELETE /api/bots/[id] - Delete a bot
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('bots')
      .delete()
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete bot' },
      { status: 500 }
    )
  }
}
