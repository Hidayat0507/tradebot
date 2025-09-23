'use client'

import { useState, useEffect, useCallback } from 'react'
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

  const fetchBalance = useCallback(async () => {
    if (!botId) {
      setError('Bot ID is missing')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/exchange/balance?botId=${encodeURIComponent(botId)}`, {
        method: 'GET',
        cache: 'no-store'
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        const message = typeof errorPayload.error === 'string'
          ? errorPayload.error
          : `Failed to fetch balance (status ${response.status})`
        throw new Error(message)
      }

      const payload = await response.json()
      const balanceData = payload?.data?.balance as {
        total?: Record<string, number>
        free?: Record<string, number>
        used?: Record<string, number>
      } | undefined

      if (!balanceData || !balanceData.total) {
        setBalance(null)
        return
      }

      const formatted: Record<string, CurrencyBalance> = {}
      Object.keys(balanceData.total).forEach(currency => {
        formatted[currency] = {
          total: balanceData.total?.[currency] ?? 0,
          free: balanceData.free?.[currency] ?? 0,
          used: balanceData.used?.[currency] ?? 0
        }
      })

      setBalance(formatted)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch balance')
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  const handleRefresh = useCallback(() => {
    fetchBalance()
  }, [fetchBalance])

  if (loading) {
    return (
      <div className="flex items-center text-gray-500">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </div>
    )
  }

  if (error) {
    // Determine if this is an API credential issue so we can hint at the fix
    const isCredentialIssue =
      error.includes('API credentials') ||
      error.includes('Authentication failed') ||
      error.includes('Permission denied') ||
      error.includes('decrypt')

    return (
      <div className="text-sm space-y-2">
        <div className="flex items-start gap-2 text-red-500">
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
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="flex items-center gap-1 text-xs"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
      </div>
    )
  }

  const defaultBalance = { total: 0, free: 0, used: 0 }

  // If no balance data, show zeros for BTC and USDC
  if (!balance || Object.keys(balance).length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>BTC:</span>
          <span>0.00000000</span>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>USDC:</span>
          <span>$0.00</span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>No balance data</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="flex items-center gap-1 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
      </div>
    )
  }

  const btcBalance = balance['BTC'] || balance['UBTC'] || balance['btc'] || balance['ubtc'] || defaultBalance
  const usdcBalance = balance['USDC'] || balance['usdc'] || defaultBalance

  const otherCurrencies = Object.entries(balance)
    .filter(([curr]) => !['BTC', 'UBTC', 'USDC', 'btc', 'ubtc', 'usdc'].includes(curr))
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 2)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">BTC:</span>
        <span>{btcBalance.total.toFixed(8)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">USDC:</span>
        <span>${usdcBalance.total.toFixed(2)}</span>
      </div>
      {otherCurrencies.map(([currency, data]) => (
        <div key={currency} className="flex items-center justify-between text-sm">
          <span className="font-medium">{currency}:</span>
          <span>{data.total.toFixed(4)}</span>
        </div>
      ))}
      <div className="pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="flex items-center gap-1 text-xs"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>
    </div>
  )
}
