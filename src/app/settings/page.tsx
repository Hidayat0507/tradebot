'use client'

import { useState, useEffect } from 'react'
import type { SupportedExchange } from '@/types'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { supabase } from '@/lib/database/client'

const initialFormData = {
  exchange: 'binance' as SupportedExchange,
  apiKey: process.env.NEXT_PUBLIC_BINANCE_API_KEY || '',
  apiSecret: process.env.NEXT_PUBLIC_BINANCE_API_SECRET || '',
  tradingEnabled: false
}

export default function SettingsPage() {
  const [formData, setFormData] = useState(initialFormData)
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Load settings from database
  useEffect(() => {
    async function loadSettings() {
      try {
        const { data: settings, error } = await supabase
          .from('exchange_config')
          .select('*')
          .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error('Error loading settings:', error)
          return
        }

        // Always use API credentials from environment variables
        setFormData({
          exchange: settings?.exchange || initialFormData.exchange,
          apiKey: initialFormData.apiKey,
          apiSecret: initialFormData.apiSecret,
          tradingEnabled: settings?.trading_enabled ?? initialFormData.tradingEnabled,
        })
      } catch (err) {
        console.error('Error loading settings:', err)
      }
    }

    loadSettings()
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setErrorMessage('')

    try {
      // Development mode warning
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ WARNING: Running in development mode. API credentials are stored as plain text.')
        console.warn('⚠️ Do not use real API credentials in development.')
      }

      const { error } = await supabase
        .from('exchange_config')
        .upsert({
          user_id: 'default_user', // We'll replace this with actual user ID later
          exchange: formData.exchange,
          api_key: formData.apiKey,
          api_secret: formData.apiSecret,
          trading_enabled: formData.tradingEnabled,
        }, {
          onConflict: 'user_id',
        })

      if (error) {
        throw new Error(error.message)
      }

      setStatus('success')
    } catch (err: any) {
      console.error('Error saving settings:', err)
      setStatus('error')
      setErrorMessage(err.message)
    }
  }

  return (
    <div className="page-background">
      <div className="page-container">
        <div className="page-content">
          <div className="mb-8">
            <h1 className="page-title font-bold text-3xl">Settings</h1>
            <p className="page-subtitle text-lg text-gray-500 dark:text-gray-400">Configure your trading bot preferences and API connections.</p>
          </div>

          <div className="container mx-auto py-8">
            {process.env.NODE_ENV === 'development' && (
              <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
                <p className="font-bold">⚠️ Development Mode</p>
                <p>API credentials are stored as plain text. Do not use real API keys in development.</p>
              </div>
            )}
            <Card className="p-6">
              <h2 className="section-title font-bold text-2xl">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Exchange Configuration
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {status === 'error' && (
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                    {errorMessage}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="exchange" className="text-lg text-gray-500 dark:text-gray-400">Exchange</Label>
                  <Select
                    id="exchange"
                    name="exchange"
                    value={formData.exchange}
                    onChange={handleChange}
                    options={[
                      { value: 'binance', label: 'Binance' },
                      { value: 'coinbase', label: 'Coinbase' },
                      { value: 'kraken', label: 'Kraken' }
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="text-lg text-gray-500 dark:text-gray-400">API Key</Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type="password"
                      name="apiKey"
                      value={formData.apiKey}
                      onChange={handleChange}
                      placeholder="Enter your API key"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiSecret" className="text-lg text-gray-500 dark:text-gray-400">API Secret</Label>
                  <div className="relative">
                    <Input
                      id="apiSecret"
                      type="password"
                      name="apiSecret"
                      value={formData.apiSecret}
                      onChange={handleChange}
                      placeholder="Enter your API secret"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tradingEnabled" className="text-lg text-gray-500 dark:text-gray-400">Trading Status</Label>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${formData.tradingEnabled ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400'}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={formData.tradingEnabled ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formData.tradingEnabled ? 'Bot is actively trading' : 'Bot is currently paused'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="tradingEnabled"
                        type="checkbox"
                        name="tradingEnabled"
                        checked={formData.tradingEnabled}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                <div className="button-group">
                  <Button
                    type="button"
                    onClick={() => setFormData(initialFormData)}
                    className="button-cancel"
                  >
                    Reset
                  </Button>
                  <Button
                    type="submit"
                    disabled={status === 'saving'}
                    className="button-submit"
                  >
                    {status === 'saving' ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
