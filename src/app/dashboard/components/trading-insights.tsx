'use client'

import React, { useMemo } from 'react'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Trade {
  pnl: number | null
  status: string
  side: string
}

interface TradingInsightsProps {
  trades: Trade[]
}

const TradingInsights: React.FC<TradingInsightsProps> = ({ trades }) => {
  const insights = useMemo(() => {
    // Filter out trades without P&L (usually buy orders or open positions)
    const tradesWithPnL = trades.filter(t => t.pnl !== null && t.pnl !== undefined)
    
    // Calculate total profit/loss from all closed trades with P&L
    const totalProfit = tradesWithPnL.reduce((sum, trade) => sum + (trade.pnl || 0), 0)
    
    // Calculate win rate (only from trades with P&L)
    const winningTrades = tradesWithPnL.filter(t => (t.pnl || 0) > 0).length
    const losingTrades = tradesWithPnL.filter(t => (t.pnl || 0) < 0).length
    const totalClosedTrades = tradesWithPnL.length
    const winRate = totalClosedTrades > 0 ? (winningTrades / totalClosedTrades) * 100 : 0
    
    // Total number of all trades
    const totalTrades = trades.length
    
    // Profit trend
    const isProfitable = totalProfit > 0
    const profitChange = totalProfit // Could calculate % change if we track historical data
    
    return {
      totalProfit,
      winRate,
      totalTrades,
      winningTrades,
      losingTrades,
      totalClosedTrades,
      isProfitable,
      profitChange
    }
  }, [trades])

  return (
    <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900 dark:text-white">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="text-blue-500"
          >
            <path d="M12 20v-6M6 20V10M18 20V4" />
          </svg>
          Trading Performance
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-300">
          Comprehensive insights into your trading activities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Profit */}
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
            <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Realized P&L</h3>
            <div className="flex items-center justify-between">
              <span className={`text-2xl font-bold ${insights.isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                ${insights.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <Badge 
                variant={insights.isProfitable ? 'default' : 'destructive'} 
                className={insights.isProfitable 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}
              >
                {insights.isProfitable ? (
                  <TrendingUp className="w-3 h-3 mr-1 inline" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1 inline" />
                )}
                {insights.totalClosedTrades} trades
              </Badge>
            </div>
          </div>
          
          {/* Win Rate */}
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
            <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Win Rate</h3>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-blue-600">
                {insights.winRate.toFixed(1)}%
              </span>
              <Badge 
                variant="secondary" 
                className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
              >
                {insights.winningTrades}W / {insights.losingTrades}L
              </Badge>
            </div>
          </div>
          
          {/* Total Trades */}
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
            <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Trades</h3>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-purple-600">
                {insights.totalTrades}
              </span>
              <Badge 
                variant="outline" 
                className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
              >
                {insights.totalClosedTrades} closed
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default TradingInsights
