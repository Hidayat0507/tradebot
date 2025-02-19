import { NextResponse } from 'next/server'
import { supabase } from '@/lib/database/client'

// GET /api/bots/[id] - Get a specific bot's details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('bots')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching bot:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bot' },
      { status: 500 }
    )
  }
}

// PATCH /api/bots/[id] - Update a bot's settings
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payload = await request.json()
    const { data, error } = await supabase
      .from('bots')
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating bot:', error)
    return NextResponse.json(
      { error: 'Failed to update bot' },
      { status: 500 }
    )
  }
}

// DELETE /api/bots/[id] - Delete a bot
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabase
      .from('bots')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json(
      { message: 'Bot deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting bot:', error)
    return NextResponse.json(
      { error: 'Failed to delete bot' },
      { status: 500 }
    )
  }
}
