'use client'

import React from 'react'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const TradingInsights: React.FC = () => {
  const totalProfit = 0
  const winRate = 0
  const totalTrades = 0

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
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
            <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Profit</h3>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-green-600">
                ${totalProfit.toLocaleString()}
              </span>
              <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                N/A
              </Badge>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
            <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Win Rate</h3>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-blue-600">
                {winRate}%
              </span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                Pending
              </Badge>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
            <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Trades</h3>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-purple-600">
                {totalTrades}
              </span>
              <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                Calculating
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default TradingInsights
