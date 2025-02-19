'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from '@/lib/database/client'
import type { SupportedExchange } from '@/types'
import { useRouter } from 'next/navigation'

interface ExchangeSetupTabProps {
  onValidated: (config: { exchange: SupportedExchange; apiKey: string; apiSecret: string }) => void
}

const SUPPORTED_EXCHANGES = [
  { id: 'binance', name: 'Binance' },
  { id: 'coinbase', name: 'Coinbase' },
  { id: 'kraken', name: 'Kraken' },
] as const

export default function ExchangeSetupTab({ onValidated }: ExchangeSetupTabProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    exchange: 'binance' as SupportedExchange,
    apiKey: '',
    apiSecret: '',
  })
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadExistingConfig() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          router.push('/auth')
          return
        }

        const { data, error } = await supabase
          .from('exchange_config')
          .select('exchange, api_key, api_secret')
          .eq('user_id', session.user.id)
          .maybeSingle()

        if (error) throw error

        if (data) {
          setFormData({
            exchange: data.exchange as SupportedExchange,
            apiKey: data.api_key,
            apiSecret: data.api_secret,
          })
        }
      } catch (err: any) {
        console.error('Failed to load exchange config:', err.message)
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadExistingConfig()
  }, [router])

  const handleValidate = async () => {
    setIsValidating(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/auth')
        return
      }

      // Store credentials first
      const { error: dbError } = await supabase
        .from('exchange_config')
        .upsert({
          user_id: session.user.id,
          exchange: formData.exchange,
          api_key: formData.apiKey,
          api_secret: formData.apiSecret,
        }, {
          onConflict: 'user_id'
        })

      if (dbError) throw dbError

      // Then validate them
      const response = await fetch('/api/exchange/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: formData.apiKey,
          apiSecret: formData.apiSecret,
          exchange: formData.exchange
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to validate exchange credentials')
      }

      // Notify parent component
      onValidated(formData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsValidating(false)
    }
  }

  if (isLoading) {
    return <div className="text-gray-700 dark:text-gray-300">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="exchange" className="text-lg text-gray-700 dark:text-gray-300">Exchange</Label>
          <select
            id="exchange"
            value={formData.exchange}
            onChange={(e) => setFormData(prev => ({ ...prev, exchange: e.target.value as SupportedExchange }))}
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {SUPPORTED_EXCHANGES.map(({ id, name }) => (
              <option key={id} value={id} className="text-gray-700 dark:text-gray-300">
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey" className="text-lg text-gray-700 dark:text-gray-300">API Key</Label>
          <div className="relative">
            <Input
              id="apiKey"
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="Enter your API key"
              className="text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiSecret" className="text-lg text-gray-700 dark:text-gray-300">API Secret</Label>
          <div className="relative">
            <Input
              id="apiSecret"
              type="password"
              value={formData.apiSecret}
              onChange={(e) => setFormData(prev => ({ ...prev, apiSecret: e.target.value }))}
              placeholder="Enter your API secret"
              className="text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
            />
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-500 dark:text-red-400">
            {error}
          </div>
        )}

        <Button
          onClick={handleValidate}
          disabled={isValidating || isLoading || !formData.apiKey || !formData.apiSecret}
          className="w-full"
        >
          {isLoading ? 'Loading...' : isValidating ? 'Validating...' : 'Validate & Save'}
        </Button>
      </div>
    </div>
  )
}
