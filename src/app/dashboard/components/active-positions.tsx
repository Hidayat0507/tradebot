'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { TrendingUp, TrendingDown, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Trade {
  id: string
  botId: string
  botName?: string
  symbol: string
  side: string
  size: number
  price: number | null
  timestamp: string
}

interface PositionWithUnrealized extends Trade {
  currentPrice: number | null
  unrealizedPnL: number | null
  priceChange: number | null
  holdingTime: string
}

interface ActivePositionsProps {
  trades: Trade[]
}

export default function ActivePositions({ trades }: ActivePositionsProps) {
  const [positions, setPositions] = useState<PositionWithUnrealized[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filter only buy orders (open positions) that haven't been closed
  const openPositions = trades.filter(t => t.side.toLowerCase() === 'buy' && t.price !== null)

  const fetchMarketPrices = useCallback(async () => {
    if (openPositions.length === 0) {
      setIsLoading(false)
      return
    }

    try {
      // Get unique symbols from open positions
      const uniqueSymbols = Array.from(new Set(openPositions.map(t => t.symbol)))
      
      // Fetch current prices for all symbols
      const pricePromises = uniqueSymbols.map(async (symbol) => {
        try {
          const response = await fetch('/api/exchange/market', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exchange: 'bitget', symbol })
          })
          
          if (!response.ok) return null
          
          const data = await response.json()
          return {
            symbol,
            price: data.success && data.data?.last_price ? data.data.last_price : null
          }
        } catch (error) {
          console.error(`Failed to fetch price for ${symbol}:`, error)
          return null
        }
      })

      const priceResults = await Promise.all(pricePromises)
      const priceMap = new Map<string, number>()
      
      priceResults.forEach(result => {
        if (result && result.price) {
          priceMap.set(result.symbol, result.price)
        }
      })

      // Calculate unrealized P&L for each position
      const positionsWithUnrealized = openPositions.map(position => {
        const currentPrice = priceMap.get(position.symbol) || null
        const entryPrice = position.price || 0
        
        let unrealizedPnL = null
        let priceChange = null
        
        if (currentPrice && entryPrice > 0) {
          // Calculate unrealized P&L: (Current Price - Entry Price) * Size
          unrealizedPnL = (currentPrice - entryPrice) * position.size
          // Calculate percentage change
          priceChange = ((currentPrice - entryPrice) / entryPrice) * 100
        }

        // Calculate holding time
        const holdingTime = calculateHoldingTime(position.timestamp)

        return {
          ...position,
          currentPrice,
          unrealizedPnL,
          priceChange,
          holdingTime
        }
      })

      setPositions(positionsWithUnrealized)
    } catch (error) {
      console.error('Error fetching market prices:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [openPositions.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMarketPrices()
    
    // Refresh prices every 30 seconds
    const interval = setInterval(fetchMarketPrices, 30000)
    return () => clearInterval(interval)
  }, [fetchMarketPrices])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchMarketPrices()
  }

  // Calculate total unrealized P&L
  const totalUnrealizedPnL = positions.reduce((sum, pos) => 
    sum + (pos.unrealizedPnL || 0), 0
  )

  if (isLoading) {
    return (
      <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900 dark:text-white">
            <svg 
              className="w-6 h-6 text-blue-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" 
              />
            </svg>
            Active Positions
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            Your current open trading positions with unrealized P&L
          </CardDescription>
        </CardHeader>
        <CardContent>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-12 w-full mb-2" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (positions.length === 0) {
    return (
      <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900 dark:text-white">
            <svg 
              className="w-6 h-6 text-blue-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" 
              />
            </svg>
            Active Positions
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            Your current open trading positions with unrealized P&L
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-800 dark:text-gray-200">
              No active positions
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900 dark:text-white">
              <svg 
                className="w-6 h-6 text-blue-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" 
                />
              </svg>
              Active Positions
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300">
              {positions.length} open position{positions.length !== 1 ? 's' : ''} • Total Unrealized P&L: 
              <span className={`ml-1 font-semibold ${totalUnrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${totalUnrealizedPnL.toFixed(2)}
              </span>
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bot</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-right">Entry Price</TableHead>
                <TableHead className="text-right">Current Price</TableHead>
                <TableHead className="text-right">Change %</TableHead>
                <TableHead className="text-right">Unrealized P&L</TableHead>
                <TableHead className="text-right">Holding Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position) => (
                <TableRow key={position.id}>
                  <TableCell className="font-medium">{position.botName || 'Unknown Bot'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{position.symbol}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{position.size.toFixed(4)}</TableCell>
                  <TableCell className="text-right">
                    ${position.price?.toFixed(2) || 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    {position.currentPrice ? (
                      `$${position.currentPrice.toFixed(2)}`
                    ) : (
                      <span className="text-gray-400">Loading...</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {position.priceChange !== null ? (
                      <Badge 
                        variant={position.priceChange >= 0 ? 'default' : 'destructive'}
                        className={position.priceChange >= 0 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                        }
                      >
                        {position.priceChange >= 0 ? (
                          <TrendingUp className="w-3 h-3 mr-1 inline" />
                        ) : (
                          <TrendingDown className="w-3 h-3 mr-1 inline" />
                        )}
                        {Math.abs(position.priceChange).toFixed(2)}%
                      </Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {position.unrealizedPnL !== null ? (
                      <span className={`font-semibold ${position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${position.unrealizedPnL.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-gray-600 dark:text-gray-400">
                    {position.holdingTime}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function calculateHoldingTime(timestamp: string): string {
  const now = new Date()
  const entryTime = new Date(timestamp)
  const diffMs = now.getTime() - entryTime.getTime()
  
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) {
    return `${diffDays}d ${diffHours % 24}h`
  } else if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes % 60}m`
  } else {
    return `${diffMinutes}m`
  }
}

