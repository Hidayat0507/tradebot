'use client'

import { useState } from 'react'

interface StrategyConfig {
  symbol: string
  action: 'BUY' | 'SELL'
  price: string
  strategy: string
  stoplossPercent?: number
}

interface StrategyConfigProps {
  pair: string
  onConfigChange: (config: StrategyConfig) => void
  className?: string
}

export default function StrategyConfig({ pair, onConfigChange, className }: StrategyConfigProps) {
  const [config, setConfig] = useState<StrategyConfig>({
    symbol: pair,
    action: 'BUY',
    price: '{{close}}',
    strategy: '',
    stoplossPercent: 2.5
  })

  const handleChange = (field: keyof StrategyConfig, value: string | number) => {
    const newConfig = { ...config, [field]: value }
    setConfig(newConfig)
    onConfigChange(newConfig)
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <label htmlFor="strategy" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Strategy Name
        </label>
        <input
          type="text"
          id="strategy"
          value={config.strategy}
          onChange={(e) => handleChange('strategy', e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
          placeholder="Enter strategy name"
        />
      </div>

      <div>
        <label htmlFor="action" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Action
        </label>
        <select
          id="action"
          value={config.action}
          onChange={(e) => handleChange('action', e.target.value as 'BUY' | 'SELL')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
        >
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
      </div>

      <div>
        <label htmlFor="stoploss" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Stoploss Percentage
        </label>
        <input
          type="number"
          id="stoploss"
          value={config.stoplossPercent}
          onChange={(e) => handleChange('stoplossPercent', parseFloat(e.target.value))}
          step="0.1"
          min="0"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
          placeholder="Enter stoploss percentage"
        />
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400">
        <p>Trading pair: {config.symbol}</p>
        <p>Price: {config.price} (using latest close price)</p>
      </div>
    </div>
  )
}
