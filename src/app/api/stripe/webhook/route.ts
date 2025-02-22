import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'

const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

export async function POST(req: Request) {
  const body = await req.text()
  const signature = headers().get('Stripe-Signature') as string
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event: any

  try {
    if (!signature || !webhookSecret) throw new Error('Missing Stripe webhook secret')
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error(`❌ Error message: ${err.message}`)
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }

  if (relevantEvents.has(event.type)) {
    try {
      const supabase = createClient()

      switch (event.type) {
        case 'checkout.session.completed':
          const checkoutSession = event.data.object
          const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription)
          
          // Add subscription to database
          await supabase.from('subscriptions').insert({
            id: subscription.id,
            user_id: checkoutSession.client_reference_id,
            plan_id: subscription.items.data[0].price.product,
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000),
          })
          break

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          const sub = event.data.object
          
          // Update subscription in database
          await supabase.from('subscriptions').upsert({
            id: sub.id,
            status: sub.status,
            current_period_end: new Date(sub.current_period_end * 1000),
            cancel_at_period_end: sub.cancel_at_period_end,
          })
          break

        default:
          throw new Error('Unhandled relevant event!')
      }
    } catch (error) {
      console.error(error)
      return new NextResponse('Webhook handler failed', { status: 500 })
    }
  }

  return new NextResponse(JSON.stringify({ received: true }))
}
