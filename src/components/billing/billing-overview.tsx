'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SubscriptionResponse = {
  limit: number | null
  plan: string
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
  hasStripeSubscription: boolean
}

type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: string
}

const PLAN_DESCRIPTIONS: Record<string, string> = {
  free: 'Free plan • Up to 5 bots',
  pro: 'Pro plan • Up to 25 bots',
  admin: 'Admin access • Unlimited bots',
}

function formatPeriodEnd(value: string | null) {
  if (!value) return null

  try {
    const formatter = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    return formatter.format(new Date(value))
  } catch {
    return value
  }
}

interface BillingOverviewProps {
  className?: string
  showHeader?: boolean
}

export function BillingOverview({ className, showHeader = true }: BillingOverviewProps) {
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const loadSubscription = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/subscription', { cache: 'no-store' })
      const json = (await res.json()) as ApiResponse<SubscriptionResponse>

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'Failed to load subscription')
      }

      setSubscription(json.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSubscription()
  }, [loadSubscription])

  const redirectWithEndpoint = useCallback(async (endpoint: '/api/stripe/checkout' | '/api/stripe/portal') => {
    try {
      setActionLoading(true)
      setError(null)

      const res = await fetch(endpoint, {
        method: 'POST',
      })
      const json = (await res.json()) as ApiResponse<{ url: string }>

      if (!res.ok || !json.success || !json.data?.url) {
        throw new Error(json.error || 'Unable to start Stripe session')
      }

      window.location.assign(json.data.url)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error'
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }, [])

  return (
    <div className={cn('space-y-6', className)}>
      {showHeader && (
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Billing & Subscription</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your trading bot subscription and monitor plan limits.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/40 dark:bg-red-900/10">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">Current Plan</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {subscription ? PLAN_DESCRIPTIONS[subscription.plan] ?? 'Custom plan' : '—'}
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {subscription?.status ? subscription.status : 'unknown'}
            </span>
          </header>

          <dl className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center justify-between">
              <dt>Bot limit</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-50">
                {subscription?.limit === null ? 'Unlimited' : subscription?.limit ?? '—'}
              </dd>
            </div>
            {subscription?.currentPeriodEnd && (
              <div className="flex items-center justify-between">
                <dt>Current period ends</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-50">{formatPeriodEnd(subscription.currentPeriodEnd)}</dd>
              </div>
            )}
            {subscription?.cancelAtPeriodEnd && (
              <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                <dt>Cancellation</dt>
                <dd className="font-medium">Scheduled at period end</dd>
              </div>
            )}
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            {subscription?.plan === 'admin' ? null : subscription?.plan === 'pro' ? (
              <Button
                variant="secondary"
                disabled={actionLoading}
                onClick={() => redirectWithEndpoint('/api/stripe/portal')}
              >
                Manage billing
              </Button>
            ) : (
              <Button
                disabled={actionLoading || loading}
                onClick={() => redirectWithEndpoint('/api/stripe/checkout')}
              >
                Upgrade to Pro ($5/mo)
              </Button>
            )}
            {subscription?.plan === 'pro' && (
              <Button
                variant="outline"
                disabled={actionLoading}
                onClick={() => redirectWithEndpoint('/api/stripe/portal')}
              >
                Cancel subscription
              </Button>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">Plan Benefits</h2>
          <ul className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-300">
            <li>
              <span className="font-medium text-gray-900 dark:text-gray-50">Free:</span> create up to 5 bots.
            </li>
            <li>
              <span className="font-medium text-gray-900 dark:text-gray-50">Pro ($5/mo):</span> create up to 25 bots with priority webhook processing.
            </li>
            <li>
              <span className="font-medium text-gray-900 dark:text-gray-50">Admin:</span> unlimited bots with full access.
            </li>
          </ul>

          {!loading && subscription?.plan !== 'admin' && (
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              Need more bots? Contact support to discuss custom plans.
            </p>
          )}
        </section>
      </div>

      {loading && (
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading subscription details...</div>
      )}
    </div>
  )
}
