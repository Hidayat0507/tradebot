'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/database/client'
import { generateSecureSecret } from '@/lib/crypto'
import type { Database } from '@/lib/database/schema'
import AccountBalance from './account-balance'

const TRADING_PAIRS = [
  // Major Cryptocurrencies
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'XRP/USDT',
  'ADA/USDT',
  'DOGE/USDT',
  'SOL/USDT',
  'TRX/USDT',
  'DOT/USDT',
  'MATIC/USDT',
  // Stablecoins
  'USDC/USDT',
  'BUSD/USDT',
  'DAI/USDT',
  // DeFi Tokens
  'UNI/USDT',
  'AAVE/USDT',
  'CAKE/USDT',
  'COMP/USDT',
  'MKR/USDT',
  // Exchange Tokens
  'CRO/USDT',
  'FTT/USDT',
  'LEO/USDT',
  'HT/USDT',
  'KCS/USDT',
]

function filterTradingPairs(search: string) {
  const searchLower = search.toLowerCase()
  return TRADING_PAIRS.filter(pair =>
    pair.toLowerCase().includes(searchLower)
  )
}

type Bot = Database['public']['Tables']['bots']['Insert']

interface BotSetupTabProps {
  exchangeConfig: {
    apiKey: string
    apiSecret: string
  }
}

export default function BotSetupTab({ exchangeConfig }: BotSetupTabProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<{ name: string; pair: string }>({
    name: '',
    pair: TRADING_PAIRS[0],
  })
  const [pairSearch, setPairSearch] = useState<string>('')
  const [selectedPair, setSelectedPair] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const filteredPairs = filterTradingPairs(pairSearch)
  const showDropdown = isSearchFocused || pairSearch.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.pair) return

    setIsCreating(true)
    setError('')

    try {
      const botSecret = await generateSecureSecret()

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('Not authenticated')
      }

      const { error: createError } = await supabase
        .from('bots')
        .insert({
          name: formData.name,
          pair: formData.pair,
          secret: botSecret,
          user_id: user.id,
          status: 'active'
        })

      if (createError) throw createError

      router.push('/bots')
    } catch (err: any) {
      console.error('Failed to create bot:', err)
      setError(err.message)
      setIsCreating(false)
    }
  }

  const handlePairSelect = (pair: string) => {
    setFormData(prev => ({ ...prev, pair }))
    setPairSearch('')
    setIsSearchFocused(false)
  }

  return (
    <div className="space-y-8">
      <AccountBalance className="mb-6" />
      
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Bot Name
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter bot name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="pair" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Trading Pair
          </label>
          <div className="relative">
            <input
              type="search"
              placeholder={formData.pair || "Search trading pairs..."}
              value={pairSearch}
              onChange={(e) => setPairSearch(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => {
                setTimeout(() => setIsSearchFocused(false), 200)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
            {showDropdown && (
              <div className="absolute z-10 w-full mt-1 max-h-60 overflow-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
                {filteredPairs.map((pair) => (
                  <div
                    key={pair}
                    className="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, pair }))
                      setPairSearch('')
                      setIsSearchFocused(false)
                    }}
                  >
                    {pair}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            onClick={() => router.push('/bots')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isCreating || !formData.name || !formData.pair}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Bot'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
