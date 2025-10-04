import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, ApiError } from '@/app/api/_middleware/api-handler'
import { isAdminUser } from '@/lib/subscriptions'

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    // Check if user is admin
    if (!isAdminUser(user)) {
      throw new ApiError('Forbidden - Admin access required', 403)
    }

    const params = await context.params
    const userId = params.id

    // Delete subscription
    const { error: deleteError } = await supabase
      .from('user_subscriptions')
      .delete()
      .eq('user_id', userId)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Admin subscription delete error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete subscription' },
      { status: 500 }
    )
  }
}

