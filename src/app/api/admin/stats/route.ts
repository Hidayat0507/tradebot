import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, ApiError } from '@/app/api/_middleware/api-handler'
import { isAdminUser } from '@/lib/subscriptions'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    // Check if user is admin
    if (!isAdminUser(user)) {
      throw new ApiError('Forbidden - Admin access required', 403)
    }

    // Create admin client for privileged operations
    const adminClient = createAdminClient()

    // Get total users count using admin client
    const { data: authUsers } = await adminClient.auth.admin.listUsers()
    const totalUsers = authUsers?.users.length || 0

    // Get total bots count
    const { count: totalBots } = await supabase
      .from('bots')
      .select('*', { count: 'exact', head: true })

    // Get active subscriptions count
    const { count: activeSubscriptions } = await supabase
      .from('user_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Calculate MRR (assuming $29/month for pro plan)
    // You can make this more sophisticated based on your actual pricing
    const { data: proSubs } = await supabase
      .from('user_subscriptions')
      .select('plan')
      .eq('status', 'active')
      .eq('plan', 'pro')

    const revenue = (proSubs?.length || 0) * 29

    return NextResponse.json({
      stats: {
        totalUsers,
        totalBots: totalBots || 0,
        activeSubscriptions: activeSubscriptions || 0,
        revenue,
      },
    })
  } catch (error: any) {
    console.error('Admin stats fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}

