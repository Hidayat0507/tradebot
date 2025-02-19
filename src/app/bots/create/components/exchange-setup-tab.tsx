'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from '@/lib/database/client'
import type { SupportedExchange } from '@/types'

interface ExchangeSetupTabProps {
  onValidated: (config: { exchange: SupportedExchange; apiKey: string; apiSecret: string }) => void
}

const SUPPORTED_EXCHANGES = [
  { id: 'binance', name: 'Binance' },
  { id: 'coinbase', name: 'Coinbase' },
  { id: 'kraken', name: 'Kraken' },
] as const

export default function ExchangeSetupTab({ onValidated }: ExchangeSetupTabProps) {
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
        const { data, error } = await supabase
          .from('exchange_config')
          .select('exchange, api_key, api_secret')
          .eq('user_id', 'default_user')
          .maybeSingle()

        if (error) throw error

        if (data) {
          setFormData({
            exchange: data.exchange as SupportedExchange,
            apiKey: data.api_key,
            apiSecret: data.api_secret,
          })
        }
        // If no data, we'll keep the default state
      } catch (err: any) {
        console.error('Failed to load exchange config:', err.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadExistingConfig()
  }, [])

  const handleValidate = async () => {
    setIsValidating(true)
    setError('')

    try {
      // Test API connection with selected exchange
      const response = await fetch('/api/exchange/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate exchange credentials')
      }

      // Store validated credentials - update if exists, insert if not
      const { error: dbError } = await supabase
        .from('exchange_config')
        .upsert({
          exchange: formData.exchange,
          api_key: formData.apiKey,
          api_secret: formData.apiSecret,
          user_id: 'default_user',
        }, {
          onConflict: 'user_id',  // Update based on user_id conflict
        })

      if (dbError) throw dbError

      // Notify parent component
      onValidated(formData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="exchange" className="text-lg text-gray-500 dark:text-gray-400">Exchange</Label>
          <select
            id="exchange"
            value={formData.exchange}
            onChange={(e) => setFormData(prev => ({ ...prev, exchange: e.target.value as SupportedExchange }))}
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {SUPPORTED_EXCHANGES.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey" className="text-lg text-gray-500 dark:text-gray-400">API Key</Label>
          <div className="relative">
            <Input
              id="apiKey"
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="Enter your API key"
              className="text-gray-700 dark:text-gray-300"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiSecret" className="text-lg text-gray-500 dark:text-gray-400">API Secret</Label>
          <div className="relative">
            <Input
              id="apiSecret"
              type="password"
              value={formData.apiSecret}
              onChange={(e) => setFormData(prev => ({ ...prev, apiSecret: e.target.value }))}
              placeholder="Enter your API secret"
              className="text-gray-700 dark:text-gray-300"
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
