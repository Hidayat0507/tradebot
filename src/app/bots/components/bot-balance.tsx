'use client'

import { useState, useEffect } from 'react'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BotBalanceProps {
  botId: string
}

interface CurrencyBalance {
  free: number
  used: number
  total: number
}

export function BotBalance({ botId }: BotBalanceProps) {
  const [balance, setBalance] = useState<Record<string, CurrencyBalance> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBalance()
  }, [botId])
  
  async function fetchBalance() {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/exchange/balance?botId=${botId}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch balance')
      }
      
      setBalance(data.balance)
    } catch (err: any) {
      console.error('Error fetching balance:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center text-gray-500">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </div>
    )
  }
  
  if (error) {
    // Determine if this is an API credential issue
    const isCredentialIssue = 
      error.includes('API credentials') || 
      error.includes('Authentication failed') || 
      error.includes('Permission denied') ||
      error.includes('decrypt');
    
    return (
      <div className="text-sm">
        <div className="flex items-start gap-2 text-red-500 mb-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Error:</p>
            <p>{error}</p>
            {isCredentialIssue && (
              <a 
                href={`/bots/${botId}/settings`} 
                className="text-blue-500 hover:text-blue-700 block mt-1"
              >
                Update API credentials
              </a>
            )}
          </div>
        </div>
        <Button 
          onClick={() => fetchBalance()} 
          variant="secondary" 
          size="sm"
          className="h-7 px-2 text-xs"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    )
  }
  
  if (!balance || Object.keys(balance).length === 0) {
    return <div className="text-gray-500 text-sm">No balance data</div>
  }
  
  // Display the top 3 currencies by total value
  const topCurrencies = Object.entries(balance)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 3)
  
  return (
    <div className="space-y-1">
      {topCurrencies.map(([currency, data]) => (
        <div key={currency} className="flex justify-between text-sm">
          <span className="font-medium">{currency}:</span>
          <span>{data.total.toFixed(4)}</span>
        </div>
      ))}
      <div className="pt-1">
        <Button 
          onClick={() => fetchBalance()} 
          variant="ghost" 
          size="sm"
          className="h-6 w-6 p-0"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
