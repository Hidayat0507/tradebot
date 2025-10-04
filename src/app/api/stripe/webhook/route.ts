import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripeClient } from '@/lib/stripe'
import { createServiceClient } from '@/utils/supabase/server'
import { logger, normalizeError } from '@/lib/logging'

export const runtime = 'nodejs'

const PRO_PLAN_MAX_BOTS = 25
const FREE_PLAN_MAX_BOTS = 5

function toIso(timestamp: number | null | undefined) {
  if (!timestamp) return null
  return new Date(timestamp * 1000).toISOString()
}

function resolvePlanFromSubscription(subscription: Stripe.Subscription | null) {
  if (!subscription) {
    return { plan: 'free', maxBots: FREE_PLAN_MAX_BOTS }
  }

  const configuredPriceId = process.env.STRIPE_PRICE_ID
  const subscriptionPriceIds = subscription.items.data
    .map((item) => item.price?.id)
    .filter((id): id is string => Boolean(id))

  if (configuredPriceId && subscriptionPriceIds.includes(configuredPriceId)) {
    return { plan: 'pro', maxBots: PRO_PLAN_MAX_BOTS }
  }

  return { plan: 'free', maxBots: FREE_PLAN_MAX_BOTS }
}

async function upsertSubscriptionRecord(params: {
  userId: string
  customerId: string
  subscription: Stripe.Subscription | null
  statusOverride?: string
  cancelAtPeriodEnd?: boolean
}) {
  const { userId, customerId, subscription, statusOverride, cancelAtPeriodEnd } = params
  const { plan, maxBots } = resolvePlanFromSubscription(subscription)
  const serviceClient = createServiceClient()

  const { error } = await serviceClient
    .from('user_subscriptions')
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription ? subscription.id : null,
        status: statusOverride ?? subscription?.status ?? 'inactive',
        plan,
        max_bots: maxBots,
        current_period_end: subscription ? toIso(subscription.current_period_end) : null,
        cancel_at_period_end: cancelAtPeriodEnd ?? subscription?.cancel_at_period_end ?? false,
        metadata: subscription ? { ...subscription.metadata } : null,
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    throw normalizeError(error, 'Failed to upsert subscription record')
  }
}

async function handleSubscriptionEvent(event: Stripe.Event) {
  const stripe = getStripeClient()
  const subscription = event.data.object as Stripe.Subscription
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

  const userId = subscription.metadata?.supabase_user_id

  let resolvedUserId = userId

  if (!resolvedUserId) {
    const customer = await stripe.customers.retrieve(customerId)
    if (customer.deleted) {
      throw new Error('Stripe customer was deleted, cannot resolve user id')
    }
    const metadataId = (customer.metadata?.supabase_user_id as string | undefined) ?? null

    if (!metadataId) {
      throw new Error('Missing supabase_user_id metadata on Stripe customer')
    }

    resolvedUserId = metadataId
  }

  await upsertSubscriptionRecord({
    userId: resolvedUserId,
    customerId,
    subscription,
  })
}

async function handleCheckoutCompleted(event: Stripe.Event) {
  const stripe = getStripeClient()
  const session = event.data.object as Stripe.Checkout.Session

  if (session.mode !== 'subscription' || !session.subscription) {
    return
  }

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription.id
  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id

  if (!customerId) {
    throw new Error('Stripe checkout session missing customer id')
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  const userId = (session.metadata?.supabase_user_id as string | undefined)
    ?? (subscription.metadata?.supabase_user_id as string | undefined)

  let resolvedUserId = userId

  if (!resolvedUserId) {
    const customer = await stripe.customers.retrieve(customerId)
    if (customer.deleted) {
      throw new Error('Stripe customer was deleted, cannot resolve user id from checkout session')
    }
    const metadataId = (customer.metadata?.supabase_user_id as string | undefined) ?? null

    if (!metadataId) {
      throw new Error('Missing supabase_user_id metadata on Stripe customer for checkout session')
    }

    resolvedUserId = metadataId
  }

  await upsertSubscriptionRecord({
    userId: resolvedUserId,
    customerId,
    subscription,
  })
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id
  const userId = subscription.metadata?.supabase_user_id

  let resolvedUserId = userId

  if (!resolvedUserId) {
    const stripe = getStripeClient()
    const customer = await stripe.customers.retrieve(customerId)
    if (customer.deleted) {
      throw new Error('Stripe customer was deleted, cannot resolve user id for cancellation')
    }
    const metadataId = (customer.metadata?.supabase_user_id as string | undefined) ?? null

    if (!metadataId) {
      throw new Error('Missing supabase_user_id metadata on Stripe customer for cancellation event')
    }

    resolvedUserId = metadataId
  }

  await upsertSubscriptionRecord({
    userId: resolvedUserId,
    customerId,
    subscription: null,
    statusOverride: 'canceled',
    cancelAtPeriodEnd: false,
  })
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    logger.warn('Missing Stripe signature header on webhook request')
    return NextResponse.json({ error: 'Signature missing' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured', new Error('Missing webhook secret'))
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const stripe = getStripeClient()
  const payload = await request.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    const normalized = normalizeError(error, 'Invalid Stripe webhook signature')
    logger.webhookError(normalized, { stage: 'signature_verification' })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionEvent(event)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event)
        break
      default:
        logger.debug('Unhandled Stripe webhook event', { eventType: event.type })
    }

    logger.webhookSuccess({ eventType: event.type })
    return NextResponse.json({ received: true })
  } catch (error) {
    const normalized = normalizeError(error)
    logger.webhookError(normalized, { eventType: event.type })
    return NextResponse.json({ error: normalized.message }, { status: 500 })
  }
}
