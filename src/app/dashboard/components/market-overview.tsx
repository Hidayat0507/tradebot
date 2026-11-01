'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

  const fetchMarketData = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/exchange/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange: 'bitget', symbols: DEFAULT_SYMBOLS.map(item => item.symbol) }),
        signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) throw new Error(`Market request failed (${response.status})`)
      const result = await response.json()
      if (!result.success || !Array.isArray(result.data)) throw new Error('Invalid ticker response')
      const validData = result.data.filter((row: MarketData & { error?: boolean }) => !row?.error && typeof row?.last_price === 'number' && Number.isFinite(row.last_price) && row.last_price > 0)
      if (result.data.length > 0 && !validData.length) throw new Error('No tickers available')
      setMarketData(validData.slice(0, 6))
      setError(null)
    } catch (err) {
      setError('Failed to load market data')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMarketData()
    const intervalId = setInterval(() => { if (document.visibilityState === 'visible') fetchMarketData() }, 60000) // Refresh every minute

    return () => clearInterval(intervalId)
  }, [fetchMarketData])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="status" className="sr-only">Loading market prices…</p>
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
          <p role="alert" className="mb-3 text-red-600 dark:text-red-400">{error}. Check your connection and try again.</p>
          <Button variant="outline" onClick={fetchMarketData}>Try again</Button>
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
        {marketData.length === 0 ? (
          <div className="space-y-3">
            <p>No market prices are available yet.</p>
            <Button variant="outline" onClick={fetchMarketData}>Refresh prices</Button>
          </div>
        ) : <Table>
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
        </Table>}
      </CardContent>
    </Card>
  )
}
