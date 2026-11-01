'use client'

import { EmptyState } from '@/components/empty-state'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { tradesCsv } from '@/lib/trade-export'
import { formatDateTime } from '@/lib/format'
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
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { ModeBadge } from "@/components/bot/ModeBadge"

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
  paper?: boolean
}

interface TradesTableProps {
  error?: string | null
  trades: TradeEntry[]
  isLoading: boolean
  onRefresh: () => void
}

export default function TradesTable({ trades, isLoading, onRefresh, error }: TradesTableProps) {
  const [filterText, setFilterText] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 6

  const filteredTrades = trades.filter(trade => 
    trade.symbol.toLowerCase().includes(filterText.toLowerCase()) ||
    trade.side.toLowerCase().includes(filterText.toLowerCase()) ||
    trade.status.toLowerCase().includes(filterText.toLowerCase()) ||
    (trade.botName && trade.botName.toLowerCase().includes(filterText.toLowerCase()))
  )

  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedTrades = filteredTrades.slice((currentPage - 1) * pageSize, currentPage * pageSize)

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
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-2">
        <div className="relative w-full sm:w-64">
          <Input
            placeholder="Filter trades..."
            value={filterText}
            onChange={(e) => { setFilterText(e.target.value); setPage(1) }}
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
        <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={isLoading || !!error || filteredTrades.length === 0} onClick={() => {
          const url = URL.createObjectURL(new Blob([tradesCsv(filteredTrades)], { type: 'text/csv;charset=utf-8;' }))
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = 'tradebot-trades.csv'
          document.body.appendChild(anchor)
          anchor.click()
          anchor.remove()
          setTimeout(() => URL.revokeObjectURL(url), 0)
        }}>Export CSV</Button>
        <Button
          variant="secondary" 
          size="sm" 
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1"
        >
          <RefreshCw aria-hidden className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{filteredTrades.length} loaded trades match your filter. CSV includes all matching loaded rows. History is limited to the latest 100 saved trades and 100 simulated alerts.</p>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {!isLoading && !error && filteredTrades.length === 0 && <EmptyState title={trades.length ? 'No matching trades' : 'No trades yet'} description={trades.length ? 'Try another symbol, bot name, side or status.' : 'Trades will appear here after your bot receives a trading alert.'} />}
      {!error && (isLoading || filteredTrades.length > 0) && <>

      <ul className="md:hidden space-y-2" aria-label="Trades">
        {isLoading ? <li className="py-6 text-center text-sm">Loading trades...</li>
          : paginatedTrades.length === 0 ? <li className="py-6 text-center text-sm">No trades found</li>
          : paginatedTrades.map((trade) => (
          <li key={trade.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium break-words">{trade.botName || trade.botId}</span>
              <ModeBadge mode={trade.paper || trade.simulated ? 'paper' : 'live'} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span>{trade.symbol}</span>
              <Badge className={getSideColor(trade.side)}>{trade.side.toUpperCase()}</Badge>
              <Badge className={getStatusColor(trade.status)}>{trade.status.toUpperCase()}</Badge>
            </div>
            <div className="mt-1 text-gray-600 dark:text-gray-300">
              {trade.size} @ ${trade.price.toLocaleString()} · PnL {trade.pnl !== null ? `$${trade.pnl.toLocaleString()}` : '-'}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDateTime(trade.timestamp)}</div>
          </li>
        ))}
      </ul>

      <div className="hidden md:block rounded-md border">
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
            ) : paginatedTrades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No trades found
                </TableCell>
              </TableRow>
            ) : (
              paginatedTrades.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell className="font-medium">
                    {trade.botName || trade.botId}
                    <ModeBadge mode={trade.paper || trade.simulated ? 'paper' : 'live'} className="ml-2" />
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
                    {formatDateTime(trade.timestamp)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </>}
      {/* Pagination Controls */}
      {!error && !isLoading && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm">Page {currentPage} of {totalPages}</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
} 