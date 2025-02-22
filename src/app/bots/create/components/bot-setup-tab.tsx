'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/database/client'
import { generateSecureSecret } from '@/lib/crypto'
import type { Database } from '@/lib/database/schema'
import { botFormSchema, type BotFormValues } from '@/lib/validations/bot'
import AccountBalance from './account-balance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

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

  const onSubmit = async (values: BotFormValues) => {
    try {
      const supabase = createClient()
      const webhookSecret = generateSecureSecret()
      
      const { error } = await supabase
        .from('bots')
        .insert({
          name: values.name,
          exchange: exchangeConfig.exchange,
          pair: values.pair,
          max_position_size: values.maxPositionSize,
          stoploss_percentage: values.stoplossPercentage,
          status: values.status,
          webhook_secret: webhookSecret,
          api_key: exchangeConfig.apiKey,
          api_secret: exchangeConfig.apiSecret,
        })

      if (error) throw error

      router.push('/bots')
    } catch (error) {
      console.error('Error creating bot:', error)
      form.setError('root', {
        type: 'server',
        message: 'Failed to create bot. Please try again.',
      })
    }
  }

  return (
    <div className="space-y-8">
      <AccountBalance className="mb-6" />

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
            <Button type="submit">
              Create Bot
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
