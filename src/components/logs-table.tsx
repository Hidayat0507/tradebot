'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, RefreshCcw } from 'lucide-react'

export type LogEntry = {
  id: string
  botId: string
  botName: string
  timestamp: string
  type: 'info' | 'warning' | 'error' | 'success'
  message: string
  details?: Record<string, any>
}

interface LogsTableProps {
  logs: LogEntry[]
  isLoading?: boolean
  onRefresh?: () => void
}

export default function LogsTable({ logs, isLoading, onRefresh }: LogsTableProps) {
  const [filter, setFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.message.toLowerCase().includes(filter.toLowerCase()) ||
      log.botName.toLowerCase().includes(filter.toLowerCase())
    
    const matchesType = typeFilter === 'all' || log.type === typeFilter

    return matchesSearch && matchesType
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          defaultValue="all"
          value={typeFilter}
          onValueChange={setTypeFilter}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue>
              {typeFilter === 'all' ? 'All Types' : typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="success">Success</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-10 w-10"
        >
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Bot</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-[40%]">Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground h-32">
                  No logs found
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono">
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>{log.botName}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset",
                      {
                        'bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/20': log.type === 'info',
                        'bg-yellow-50 text-yellow-700 ring-yellow-700/10 dark:bg-yellow-400/10 dark:text-yellow-400 dark:ring-yellow-400/20': log.type === 'warning',
                        'bg-red-50 text-red-700 ring-red-700/10 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20': log.type === 'error',
                        'bg-green-50 text-green-700 ring-green-700/10 dark:bg-green-400/10 dark:text-green-400 dark:ring-green-400/20': log.type === 'success',
                      }
                    )}>
                      {log.type}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono">{log.message}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
