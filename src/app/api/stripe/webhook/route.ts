import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia',
})

const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get('Stripe-Signature') as string
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    let event: any

    try {
      if (!signature || !webhookSecret) throw new Error('Missing Stripe webhook secret')
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error(`Webhook signature verification failed: ${errorMessage}`)
      return new NextResponse(`Webhook Error: ${errorMessage}`, { status: 400 })
    }

    if (relevantEvents.has(event.type)) {
      try {
        const supabase = await createClient()

        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session
            const { error } = await supabase
              .from('subscriptions')
              .insert({
                user_id: session.metadata?.userId,
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
                status: 'active',
                plan: 'premium',
              })

            if (error) throw error
            break
          }
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
        console.error('Error processing webhook:', error)
        return new NextResponse('Webhook handler failed', { status: 500 })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new NextResponse('Webhook handler failed', { status: 500 })
  }
}
