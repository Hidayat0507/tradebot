'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PricingTable from '@/components/subscription/pricing-table'
import ProfileForm from '@/components/profile/profile-form'
import PasswordForm from '@/components/profile/password-form'

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

interface Subscription {
  id: string
  plan_id: string
  status: string
  current_period_end: string
  cancel_at_period_end: boolean
}

export default function AccountPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const [plansResponse, subscriptionResponse] = await Promise.all([
        supabase.from('subscription_plans').select('*'),
        supabase.from('subscriptions').select('*').single()
      ])

      if (plansResponse.data) {
        setPlans(plansResponse.data)
      }

      if (subscriptionResponse.data) {
        setSubscription(subscriptionResponse.data)
      }
    }

    loadData()
  }, [])

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">Account Settings</h1>
      
      <Tabs defaultValue="profile" className="space-y-8">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your account profile information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <ProfileForm />
              <PasswordForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Current Subscription</CardTitle>
              <CardDescription>
                {subscription ? (
                  <>
                    Your {plans.find(p => p.id === subscription.plan_id)?.name} subscription is{' '}
                    {subscription.status}. 
                    {subscription.current_period_end && (
                      <> Next billing date: {new Date(subscription.current_period_end).toLocaleDateString()}</>
                    )}
                  </>
                ) : (
                  'You are not currently subscribed to any plan.'
                )}
              </CardDescription>
            </CardHeader>
          </Card>

          <PricingTable 
            plans={plans} 
            currentPlan={subscription?.plan_id} 
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
