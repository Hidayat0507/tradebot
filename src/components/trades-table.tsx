'use client'

import { useState } from 'react'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { RefreshCw } from "lucide-react"

export type TradeEntry = {
  id: string
  botId: string
  botName?: string
  symbol: string
  side: 'buy' | 'sell'
  status: 'pending' | 'filled' | 'cancelled' | 'failed' | 'open'
  size: number
  price: number
  pnl: number | null
  timestamp: string
  simulated?: boolean
}

interface TradesTableProps {
  trades: TradeEntry[]
  isLoading: boolean
  onRefresh: () => void
}

export default function TradesTable({ trades, isLoading, onRefresh }: TradesTableProps) {
  const [filterText, setFilterText] = useState('')
  
  const filteredTrades = trades.filter(trade => 
    trade.symbol.toLowerCase().includes(filterText.toLowerCase()) ||
    trade.side.toLowerCase().includes(filterText.toLowerCase()) ||
    trade.status.toLowerCase().includes(filterText.toLowerCase()) ||
    (trade.botName && trade.botName.toLowerCase().includes(filterText.toLowerCase()))
  )

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'filled':
      case 'open':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    }
  }

  const getSideColor = (side: string) => {
    return side.toLowerCase() === 'buy' 
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-2">
        <div className="relative w-full sm:w-64">
          <Input
            placeholder="Filter trades..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-8"
          />
          <svg
            className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400"
            fill="none"
            height="24"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="24"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bot</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>PnL</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  Loading trades...
                </TableCell>
              </TableRow>
            ) : filteredTrades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No trades found
                </TableCell>
              </TableRow>
            ) : (
              filteredTrades.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell className="font-medium">
                    {trade.botName || trade.botId}
                    {trade.simulated && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Simulated
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{trade.symbol}</TableCell>
                  <TableCell>
                    <Badge className={getSideColor(trade.side)}>
                      {trade.side.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(trade.status)}>
                      {trade.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>{trade.size}</TableCell>
                  <TableCell>${trade.price.toLocaleString()}</TableCell>
                  <TableCell>
                    {trade.pnl !== null 
                      ? `$${trade.pnl.toLocaleString()}` 
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {new Date(trade.timestamp).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
} 