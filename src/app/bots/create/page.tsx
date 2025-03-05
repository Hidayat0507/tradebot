'use client'

import { Card } from "@/components/ui/card"
import ApiDocumentation from '@/app/bots/create/components/api-documentation'
import { CreateBotForm } from './components/create-bot-form'

export default function CreateBotPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Create Bot</h2>
            <p className="text-muted-foreground">Configure your trading bot settings and API credentials.</p>
          </div>
          <Card className="p-6">
            <CreateBotForm />
          </Card>
        </div>
        <ApiDocumentation />
      </div>
    </div>
  )
}
