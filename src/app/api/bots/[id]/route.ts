import { NextResponse } from 'next/server'
import { supabase } from '@/lib/database/client'

interface RequestContext {
  params: {
    id: string;
  };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function GET(
  request: Request,
  context: RequestContext
) {
  try {
    const { data, error } = await supabase
      .from('bots')
      .select('*')
      .eq('id', context.params.id)
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

export async function PATCH(
  request: Request,
  context: RequestContext
) {
  try {
    const payload = await request.json()
    const { data, error } = await supabase
      .from('bots')
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      })
      .eq('id', context.params.id)
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

export async function DELETE(
  request: Request,
  context: RequestContext
) {
  try {
    const { error } = await supabase
      .from('bots')
      .delete()
      .eq('id', context.params.id)

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
