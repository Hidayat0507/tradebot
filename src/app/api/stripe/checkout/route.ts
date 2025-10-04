import { NextRequest } from 'next/server'
import { getStripeClient, getStripePriceId, getSiteUrl } from '@/lib/stripe'
import {
  getAuthenticatedUser,
  successResponse,
  handleApiError,
  ApiError,
} from '@/app/api/_middleware/api-handler'
import { createServiceClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!user.email) {
      throw new ApiError('Email is required to start a subscription', 400)
    }

    const stripe = getStripeClient()
    const priceId = getStripePriceId()
    const siteUrl = getSiteUrl()

    const { data: subscriptionRecord, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .maybeSingle()

    if (subscriptionError) {
      throw new ApiError('Failed to fetch subscription details', 500, subscriptionError)
    }

    let customerId = subscriptionRecord?.stripe_customer_id ?? undefined
    const serviceClient = createServiceClient()

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })

      customerId = customer.id

      const { error: upsertError } = await serviceClient
        .from('user_subscriptions')
        .upsert(
          {
            user_id: user.id,
            stripe_customer_id: customerId,
            plan: 'free',
            status: 'inactive',
          },
          { onConflict: 'user_id' }
        )

      if (upsertError) {
        throw new ApiError('Failed to persist Stripe customer', 500, upsertError)
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      metadata: {
        supabase_user_id: user.id,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
        },
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/billing`,
      automatic_tax: { enabled: true },
    })

    if (!session.url) {
      throw new ApiError('Failed to create Stripe checkout session', 500)
    }

    return successResponse({ url: session.url })
  } catch (error) {
    return handleApiError(error)
  }
}
