'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatNumber, formatPrice } from '@/lib/utils'

interface MarketData {
  pairs: {
    exchange: string
    symbol: string
    price: number
    priceChange24h: number
    priceChangePercent24h: number
    volume24h: number
    high24h: number
    low24h: number
    bestBid: number
    bestAsk: number
    recentTrades: {
      price: number
      amount: number
      side: 'buy' | 'sell'
      timestamp: number
    }[]
  }[]
  errors: {
    exchange: string
    symbol: string
    error: string
  }[]
}

export function MarketOverview() {
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/exchange/market')
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch market data')
        }

        setMarketData(data)
        setError(null)
      } catch (err: any) {
        console.error('Error fetching market data:', err)
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMarketData()
    // Refresh market data every 10 seconds
    const interval = setInterval(fetchMarketData, 10000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader>
          <CardTitle>Market Overview</CardTitle>
          <CardDescription>Loading market data...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader>
          <CardTitle>Market Overview</CardTitle>
          <CardDescription className="text-red-500">Error: {error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!marketData || marketData.pairs.length === 0) {
    return (
      <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader>
          <CardTitle>Market Overview</CardTitle>
          <CardDescription>No market data available</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader>
        <CardTitle>Market Overview</CardTitle>
        <CardDescription>Real-time market data for your trading pairs</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {marketData.pairs.map((pair) => (
            <div
              key={`${pair.exchange}-${pair.symbol}`}
              className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-semibold">
                    {pair.symbol} <span className="text-sm text-gray-500">({pair.exchange})</span>
                  </h3>
                  <p className="text-2xl font-bold">
                    {formatPrice(pair.price)}
                    <span
                      className={`ml-2 text-sm ${
                        pair.priceChangePercent24h >= 0
                          ? 'text-green-500'
                          : 'text-red-500'
                      }`}
                    >
                      {pair.priceChangePercent24h >= 0 ? '+' : ''}
                      {pair.priceChangePercent24h.toFixed(2)}%
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">24h Volume</p>
                  <p className="font-semibold">{formatNumber(pair.volume24h)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">24h High</p>
                  <p className="font-semibold">{formatPrice(pair.high24h)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">24h Low</p>
                  <p className="font-semibold">{formatPrice(pair.low24h)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Best Bid</p>
                  <p className="font-semibold text-green-600">{formatPrice(pair.bestBid)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Best Ask</p>
                  <p className="font-semibold text-red-600">{formatPrice(pair.bestAsk)}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-2">Recent Trades</p>
                <div className="space-y-1">
                  {pair.recentTrades.slice(0, 5).map((trade, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm"
                    >
                      <span
                        className={trade.side === 'buy' ? 'text-green-500' : 'text-red-500'}
                      >
                        {trade.side === 'buy' ? '↑' : '↓'} {formatPrice(trade.price)}
                      </span>
                      <span className="text-gray-500">{formatNumber(trade.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
