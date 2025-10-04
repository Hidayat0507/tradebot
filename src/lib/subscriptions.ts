import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/database/schema'

export const FREE_PLAN_MAX_BOTS = 5
export const PRO_PLAN_MAX_BOTS = 25

function getAdminEmailSet() {
  const value = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
  return new Set(
    value
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function isAdminUser(user: Pick<User, 'email'>) {
  if (!user.email) return false
  return getAdminEmailSet().has(user.email.toLowerCase())
}

type Supabase = SupabaseClient<Database>

export async function fetchSubscriptionRecord(supabase: Supabase) {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export async function resolveBotLimit(
  supabase: Supabase,
  user: User
): Promise<{
  limit: number | null
  plan: string
  status: string
  subscription: Database['public']['Tables']['user_subscriptions']['Row'] | null
}> {
  if (isAdminUser(user)) {
    return {
      limit: null,
      plan: 'admin',
      status: 'active',
      subscription: null,
    }
  }

  const subscription = await fetchSubscriptionRecord(supabase)

  if (!subscription) {
    return {
      limit: FREE_PLAN_MAX_BOTS,
      plan: 'free',
      status: 'inactive',
      subscription: null,
    }
  }

  let limit: number | null = subscription.max_bots

  if (limit === null || limit === undefined) {
    limit = subscription.plan === 'pro' ? PRO_PLAN_MAX_BOTS : FREE_PLAN_MAX_BOTS
  }

  return {
    limit,
    plan: subscription.plan || 'free',
    status: subscription.status || 'inactive',
    subscription,
  }
}
