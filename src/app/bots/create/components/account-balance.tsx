'use client'

import { useEffect, useState } from 'react'

interface Balance {
  total: number
  free: number
  used: number
}

interface AccountBalanceProps {
  className?: string
}

export default function AccountBalance({ className }: AccountBalanceProps) {
  const [balances, setBalances] = useState<Record<string, Balance>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const response = await fetch('/api/exchange/balance')
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch balance')
        }

        setBalances(data.balance)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBalance()
  }, [])

  if (isLoading) {
    return (
      <div className={`rounded-lg border p-4 ${className}`}>
        <p className="text-sm text-gray-500">Loading account balance...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-red-200 p-4 ${className}`}>
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  if (Object.keys(balances).length === 0) {
    return (
      <div className={`rounded-lg border p-4 ${className}`}>
        <p className="text-sm text-gray-500">No assets found in your account</p>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Asset</th>
              <th className="px-4 py-2 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Total</th>
              <th className="px-4 py-2 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Available</th>
              <th className="px-4 py-2 text-right text-sm font-medium text-gray-500 dark:text-gray-400">In Use</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {Object.entries(balances)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([currency, balance]) => (
                <tr key={currency} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{currency}</td>
                  <td className="px-4 py-2 text-right text-sm text-gray-500 dark:text-gray-400">{balance.total.toFixed(8)}</td>
                  <td className="px-4 py-2 text-right text-sm text-gray-500 dark:text-gray-400">{balance.free.toFixed(8)}</td>
                  <td className="px-4 py-2 text-right text-sm text-gray-500 dark:text-gray-400">{balance.used.toFixed(8)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
