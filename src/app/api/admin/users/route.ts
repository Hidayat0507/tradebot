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

    // Fetch all users with their bot counts
    const { data: users, error: usersError } = await supabase
      .from('bots')
      .select('user_id')

    if (usersError) {
      throw usersError
    }

    // Count bots per user
    const botCounts: Record<string, number> = {}
    users?.forEach((bot) => {
      botCounts[bot.user_id] = (botCounts[bot.user_id] || 0) + 1
    })

    // Get all users from auth using admin client
    const { data: authUsers, error: authUsersError } = await adminClient.auth.admin.listUsers()
    
    if (authUsersError) {
      throw authUsersError
    }

    // Get all subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('user_subscriptions')
      .select('*')

    if (subsError) {
      throw subsError
    }

    // Map subscriptions by user_id
    const subsMap = new Map(
      subscriptions?.map((sub) => [sub.user_id, sub]) || []
    )

    // Combine data
    const usersData = authUsers.users.map((authUser) => ({
      id: authUser.id,
      email: authUser.email || 'N/A',
      created_at: authUser.created_at,
      bot_count: botCounts[authUser.id] || 0,
      subscription: subsMap.get(authUser.id) || null,
    }))

    return NextResponse.json({ users: usersData })
  } catch (error: any) {
    console.error('Admin users fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

