import { NextRequest } from 'next/server'
import { getStripeClient, getSiteUrl } from '@/lib/stripe'
import {
  getAuthenticatedUser,
  successResponse,
  handleApiError,
  ApiError,
} from '@/app/api/_middleware/api-handler'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { supabase } = await getAuthenticatedUser(request)

    const { data: subscriptionRecord, error } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .maybeSingle()

    if (error) {
      throw new ApiError('Failed to fetch subscription details', 500, error)
    }

    if (!subscriptionRecord?.stripe_customer_id) {
      throw new ApiError('No Stripe customer found for user', 400)
    }

    const stripe = getStripeClient()
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscriptionRecord.stripe_customer_id,
      return_url: `${getSiteUrl()}/billing`,
    })

    if (!portalSession.url) {
      throw new ApiError('Failed to create Stripe portal session', 500)
    }

    return successResponse({ url: portalSession.url })
  } catch (error) {
    return handleApiError(error)
  }
}
