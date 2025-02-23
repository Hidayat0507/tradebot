'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { generateSecureSecret } from '@/lib/crypto'
import type { Database } from '@/lib/database/schema'
import { botFormSchema, type BotFormValues } from '@/lib/validations/bot'
import AccountBalance from './account-balance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert as AlertComponent } from '@/components/ui/alert'

const TRADING_PAIRS = [
  // Major Cryptocurrencies
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'XRP/USDT',
  'ADA/USDT',
  'DOGE/USDT',
  'SOL/USDT',
  'TRX/USDT',
  'DOT/USDT',
  'MATIC/USDT',
  // Stablecoins
  'USDC/USDT',
  'BUSD/USDT',
  'DAI/USDT',
  // DeFi Tokens
  'UNI/USDT',
  'AAVE/USDT',
  'CAKE/USDT',
  'COMP/USDT',
] as const

interface BotSetupTabProps {
  exchangeConfig: {
    exchange: string
    apiKey: string
    apiSecret: string
  }
}

export default function BotSetupTab({ exchangeConfig }: BotSetupTabProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const supabase = createClient()

  const form = useForm<BotFormValues>({
    resolver: zodResolver(botFormSchema),
    defaultValues: {
      name: '',
      pair: 'BTC/USDT',
      maxPositionSize: 0.01,
      stoplossPercentage: 1,
      status: 'paused',
    },
  })

  async function onSubmit(data: BotFormValues) {
    try {
      setError(null)
      setSuccess(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const webhookSecret = generateSecureSecret()

      const { error: insertError } = await supabase
        .from('bots')
        .insert({
          name: data.name,
          exchange: exchangeConfig.exchange,
          pair: data.pair,
          max_position_size: data.maxPositionSize,
          stoploss_percentage: data.stoplossPercentage,
          status: data.status,
          webhook_secret: webhookSecret,
          api_key: exchangeConfig.apiKey,
          api_secret: exchangeConfig.apiSecret,
        })
        .select()
        .single()

      if (insertError) throw insertError

      setSuccess('Bot created successfully')
      router.push('/bots')
    } catch (err) {
      console.error('Error creating bot:', err)
      setError('Failed to create bot')
    }
  }

  return (
    <div className="space-y-8">
      <AccountBalance className="mb-6" />

      {error && (
        <AlertComponent variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </AlertComponent>
      )}

      {success && (
        <AlertComponent className="bg-green-50 text-green-700 border-green-200">
          <AlertDescription>{success}</AlertDescription>
        </AlertComponent>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bot Name</FormLabel>
                <FormControl>
                  <Input placeholder="My Trading Bot" {...field} />
                </FormControl>
                <FormDescription>
                  Give your bot a unique name to identify it easily.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="pair"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trading Pair</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a trading pair" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TRADING_PAIRS.map((pair) => (
                      <SelectItem key={pair} value={pair}>
                        {pair}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Choose the cryptocurrency pair you want to trade.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="maxPositionSize"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maximum Position Size</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.0001"
                    {...field}
                    onChange={e => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  The maximum amount of USDT to use per trade.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stoplossPercentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stoploss Percentage</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.1"
                    {...field}
                    onChange={e => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Optional: Set a stoploss percentage to limit potential losses.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/bots')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating...' : 'Create Bot'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
