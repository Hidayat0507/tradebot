import { NextRequest } from 'next/server'
import {
  getAuthenticatedUser,
  successResponse,
  handleApiError,
} from '@/app/api/_middleware/api-handler'
import { resolveBotLimit } from '@/lib/subscriptions'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { limit, plan, status, subscription } = await resolveBotLimit(supabase, user)

    return successResponse({
      limit,
      plan,
      status,
      cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
      currentPeriodEnd: subscription?.current_period_end ?? null,
      hasStripeSubscription: Boolean(subscription?.stripe_subscription_id),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
