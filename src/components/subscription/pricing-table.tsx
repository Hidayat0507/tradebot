'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Loader2 } from 'lucide-react'

if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set')
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)

interface Plan {
  id: string
  name: string
  description: string
  price_id: string
  amount: number
  currency: string
  interval: string
  features: string[]
}

interface PricingTableProps {
  plans: Plan[]
  currentPlan?: string
}

export default function PricingTable({ plans, currentPlan }: PricingTableProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  const handleSubscribe = async (priceId: string) => {
    try {
      setLoading(priceId)

      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      })

      const { sessionId } = await response.json()
      const stripe = await stripePromise

      if (!stripe) throw new Error('Failed to load Stripe')

      const { error } = await stripe.redirectToCheckout({ sessionId })

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {plans.map((plan) => (
        <Card key={plan.id} className="flex flex-col">
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <CardDescription>{plan.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="mb-4">
              <span className="text-3xl font-bold">${plan.amount}</span>
              <span className="text-muted-foreground">/{plan.interval}</span>
            </div>
            <ul className="space-y-2 text-sm">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => handleSubscribe(plan.price_id)}
              disabled={loading === plan.price_id || currentPlan === plan.id}
            >
              {loading === plan.price_id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : currentPlan === plan.id ? (
                'Current Plan'
              ) : (
                'Subscribe'
              )}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
