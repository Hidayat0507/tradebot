import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, ApiError } from '@/app/api/_middleware/api-handler'
import { isAdminUser } from '@/lib/subscriptions'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    // Check if user is admin
    if (!isAdminUser(user)) {
      throw new ApiError('Forbidden - Admin access required', 403)
    }

    const body = await request.json()
    const { plan, max_bots, status } = body
    const params = await context.params
    const userId = params.id

    // Check if subscription exists
    const { data: existing } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          plan: plan || existing.plan,
          status: status || existing.status,
          max_bots: max_bots !== undefined ? max_bots : existing.max_bots,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (updateError) {
        throw updateError
      }
    } else {
      // Create new subscription
      const { error: insertError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan: plan || 'free',
          status: status || 'active',
          max_bots: max_bots || null,
          cancel_at_period_end: false,
        })

      if (insertError) {
        throw insertError
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Admin user update error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    )
  }
}

