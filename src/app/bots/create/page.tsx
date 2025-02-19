'use client'

import { useState } from 'react'
import { Card } from "@/components/ui/card"
import ExchangeSetupTab from '@/app/bots/create/components/exchange-setup-tab'
import BotSetupTab from '@/app/bots/create/components/bot-setup-tab'
import ApiDocumentation from '@/app/bots/create/components/api-documentation'

export default function CreateBotPage() {
  const [activeTab, setActiveTab] = useState('exchange')
  const [isExchangeValidated, setIsExchangeValidated] = useState(false)
  const [exchangeConfig, setExchangeConfig] = useState({
    exchange: 'binance',
    apiKey: '',
    apiSecret: '',
  })

  const handleExchangeValidated = (config: typeof exchangeConfig) => {
    setExchangeConfig(config)
    setIsExchangeValidated(true)
    setActiveTab('bot')
  }

  return (
    <div className="page-background">
      <div className="page-container">
        <div className="page-content">
          <div className="mb-8">
            <h1 className="page-title font-bold text-3xl">Create Bot</h1>
            <p className="page-subtitle text-lg text-gray-500 dark:text-gray-400">Configure your trading bot settings and start trading.</p>
          </div>

          <div className="container mx-auto py-8">
            <Card className="p-6">
              <div className="mb-6">
                <div className="grid w-full grid-cols-2 gap-2">
                  <button
                    onClick={() => setActiveTab('exchange')}
                    className={`py-2.5 text-center rounded-lg transition-colors font-medium ${
                      activeTab === 'exchange'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    Step 1: Exchange Setup
                  </button>
                  <button
                    onClick={() => setActiveTab('bot')}
                    className={`py-2.5 text-center rounded-lg transition-colors font-medium ${
                      activeTab === 'bot'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    Step 2: Bot Configuration
                  </button>
                </div>
              </div>

              <div className="mt-6">
                {activeTab === 'exchange' && (
                  <ExchangeSetupTab onValidated={handleExchangeValidated} />
                )}
                {activeTab === 'bot' && (
                  <BotSetupTab exchangeConfig={exchangeConfig} />
                )}
              </div>
            </Card>

            {activeTab === 'bot' && (
              <ApiDocumentation botId="QRVjvR3Y" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
