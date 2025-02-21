'use client'

import { useState } from 'react'
import { Card } from "@/components/ui/card"
import ExchangeSetupTab from '@/app/bots/create/components/exchange-setup-tab'
import BotSetupTab from '@/app/bots/create/components/bot-setup-tab'
import ApiDocumentation from '@/app/bots/create/components/api-documentation'
import SessionProvider from '@/components/session-provider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
    <SessionProvider>
      <div className="page-background">
        <div className="page-container">
          <div className="page-content">
            <div className="mb-8">
              <h1 className="page-title font-bold text-3xl">Create Bot</h1>
              <p className="page-subtitle text-lg text-gray-500 dark:text-gray-400">Configure your trading bot settings and start trading.</p>
            </div>

            <div className="container mx-auto py-8">
              <Card className="p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger 
                      value="exchange" 
                      className="text-base"
                      disabled={false}
                    >
                      Step 1: Exchange Setup
                    </TabsTrigger>
                    <TabsTrigger 
                      value="bot" 
                      className="text-base"
                      disabled={!isExchangeValidated}
                    >
                      Step 2: Bot Configuration
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="exchange" className="mt-6">
                    <ExchangeSetupTab onValidated={handleExchangeValidated} />
                  </TabsContent>
                  <TabsContent value="bot" className="mt-6">
                    <BotSetupTab exchangeConfig={exchangeConfig} />
                  </TabsContent>
                </Tabs>
              </Card>

              {activeTab === 'bot' && (
                <ApiDocumentation botId="QRVjvR3Y" />
              )}
            </div>
          </div>
        </div>
      </div>
    </SessionProvider>
  )
}
