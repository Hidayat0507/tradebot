'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'

// Define market data type based on the actual API response
interface MarketData {
  symbol: string
  exchange: string
  last_price: number
  bid: number
  ask: number
  volume_24h: number
  change_24h: number
  high_24h: number
  low_24h: number
  order_book: {
    bids: number[][]
    asks: number[][]
  }
  ohlcv: {
    timestamp: number
    open: number
    high: number
    low: number
    close: number
    volume: number
  }[]
}

// Predefined list of symbols to track - using Bitget
const DEFAULT_SYMBOLS = [
  { exchange: 'bitget', symbol: 'BTC/USDT' },
  { exchange: 'bitget', symbol: 'ETH/USDT' },
  { exchange: 'bitget', symbol: 'BNB/USDT' },
  { exchange: 'bitget', symbol: 'SOL/USDT' },
  { exchange: 'bitget', symbol: 'XRP/USDT' },
  { exchange: 'bitget', symbol: 'ADA/USDT' },
]

export default function MarketOverview() {
  const [marketData, setMarketData] = useState<MarketData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMarketData() {
      try {
        setIsLoading(true)
        const promises = DEFAULT_SYMBOLS.map(async ({ exchange, symbol }) => {
          const response = await fetch('/api/exchange/market', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ exchange, symbol })
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch ${symbol} data`)
          }

          const data = await response.json()
          return data.success ? data.data : null
        })

        const results = await Promise.allSettled(promises)
        
        const validData = results
          .filter((result): result is PromiseFulfilledResult<MarketData> => 
            result.status === 'fulfilled' && result.value !== null
          )
          .map(result => result.value)

        // Since we are only fetching from Bitget, no need for unique map logic
        // Take the top 6 symbols
        const top6MarketData = validData.slice(0, 6);

        setMarketData(top6MarketData);
        setError(null);
      } catch (err) {
        setError('Failed to load market data')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMarketData()
    const intervalId = setInterval(fetchMarketData, 60000) // Refresh every minute

    return () => clearInterval(intervalId)
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-10 w-full mb-2" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exchange</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>24h Change</TableHead>
              <TableHead>24h Volume</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {marketData.map((market, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Badge variant="secondary">
                    {market?.exchange?.toUpperCase() || 'Bitget'}
                  </Badge>
                </TableCell>
                <TableCell>{market?.symbol || 'N/A'}</TableCell>
                <TableCell>
                  ${market?.last_price?.toLocaleString(undefined, { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  }) || 'N/A'}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={market?.change_24h >= 0 ? 'outline' : 'destructive'}
                  >
                    {market?.change_24h?.toFixed(2) || '0.00'}%
                  </Badge>
                </TableCell>
                <TableCell>
                  {market?.volume_24h?.toLocaleString(undefined, { 
                    minimumFractionDigits: 0, 
                    maximumFractionDigits: 0 
                  }) || 'N/A'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
