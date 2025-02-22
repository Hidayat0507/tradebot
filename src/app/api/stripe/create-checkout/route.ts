import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createCheckoutSession } from '@/lib/stripe'

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { priceId } = await req.json()

    if (!priceId) {
      return new NextResponse('Price ID is required', { status: 400 })
    }

    const checkoutSession = await createCheckoutSession({
      priceId,
      userId: user.id,
      email: user.email || '',
    })

    return new NextResponse(JSON.stringify({ sessionId: checkoutSession.id }))
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return new NextResponse('Error creating checkout session', { status: 500 })
  }
}
