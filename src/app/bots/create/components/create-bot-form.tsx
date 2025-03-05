'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { generateBotId } from '@/lib/crypto'
import type { Database } from '@/lib/database/schema'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { z } from 'zod'
import { randomBytes } from 'crypto'

const SUPPORTED_EXCHANGES = [
  { id: 'binance', name: 'Binance' },
  { id: 'hyperliquid', name: 'Hyperliquid' },
] as const

const TRADING_PAIRS = [
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
  'USDC/USDT',
  'BUSD/USDT',
  'DAI/USDT',
  'UNI/USDT',
  'AAVE/USDT',
] as const

const createBotFormSchema = z.object({
  name: z.string().min(3, 'Bot name must be at least 3 characters'),
  exchange: z.enum(['binance', 'hyperliquid'] as const),
  pair: z.string().min(1, 'Trading pair is required'),
  max_position_size: z.number()
    .min(0.0001, 'Position size must be at least 0.0001')
    .max(100000, 'Position size must be less than 100000'),
  stoploss_percentage: z.number()
    .min(0.1, 'Stoploss must be at least 0.1%')
    .max(50, 'Stoploss must be less than 50%')
    .optional(),
  api_key: z.string().min(1, 'API Key is required'),
  api_secret: z.string().optional(),
})

type CreateBotFormValues = z.infer<typeof createBotFormSchema>

export function CreateBotForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null)
  const supabase = createClient()
  const form = useForm<CreateBotFormValues>({
    resolver: zodResolver(createBotFormSchema),
    defaultValues: {
      name: '',
      pair: 'BTC/USDT',
      max_position_size: 0.01,
      exchange: 'binance',
      api_key: '',
      api_secret: '',
    },
  })

  const values = form.watch()

  async function onSubmit(values: CreateBotFormValues) {
    try {
      setIsSubmitting(true)
      setError(null)
      setSuccess(null)
      setValidationError(null)
      setValidationSuccess(null)

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw new Error('Authentication failed: Please log in again')
      if (!user) {
        alert('User is not logged in. Redirecting to login.')
        router.push('/auth/login')
        return
      }

      const userId = user.id

      if (!userId) {
        alert('User is not logged in. Redirecting to login.')
        router.push('/auth/login')
        return
      }

      // Generate a unique ID for the bot
      const botId = generateBotId()

      // Generate a webhook secret
      const webhookSecret = randomBytes(32).toString('hex')

      // Step 1: Create the bot first with placeholder values
      const { data: botData, error: botError } = await supabase
        .from('bots')
        .insert({
          id: botId,
          user_id: userId,
          name: values.name,
          exchange: values.exchange,
          pair: values.pair.replace('/', ''),
          max_position_size: values.max_position_size,
          stoploss_percentage: values.stoploss_percentage,
          enabled: false,
          // Add placeholder values that will be replaced after validation
          api_key: 'pending_validation',
          api_secret: 'pending_validation',
          webhook_secret: webhookSecret, // Auto-generate webhook secret
        })
        .select()
        .single()

      if (botError) {
        throw new Error(`Failed to create bot: ${botError.message}`)
      }

      // Step 2: Validate exchange credentials
      const requestBody = {
        botId: botId,
        exchange: values.exchange,
        apiKey: values.api_key,
        apiSecret: values.api_secret,
      }
      console.log('Sending request to validate API:', requestBody)

      const response = await fetch('/api/exchange/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      console.log('Response status:', response.status)
      
      try {
        const data = await response.json()
        console.log('Response data:', data)

        if (!response.ok) {
          // If validation fails, delete the bot we just created
          await supabase.from('bots').delete().eq('id', botId)
          
          setValidationError(data.error || 'Failed to validate exchange credentials')
          setValidationSuccess(null)
          setIsSubmitting(false)
          return
        }

        setValidationSuccess('Exchange credentials validated successfully!')
        setValidationError(null)
        setSuccess('Bot created successfully!')
        router.push('/bots')
      } catch (error: any) {
        // If something goes wrong, delete the bot we just created
        await supabase.from('bots').delete().eq('id', botId)
        
        console.error('Error validating credentials:', error)
        setError(error.message || 'An unexpected error occurred')
      } finally {
        setIsSubmitting(false)
      }
    } catch (error: any) {
      console.error('Error creating bot:', error)
      setError(error.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 border-green-500 text-green-500">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {validationError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Validation Error</AlertTitle>
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {validationSuccess && (
        <Alert className="mb-4 border-green-500 text-green-500">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Validation Success</AlertTitle>
          <AlertDescription>{validationSuccess}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Bot Configuration</h3>
              <p className="text-sm text-gray-500">
                Configure your trading bot settings.
              </p>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Trading Bot" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="exchange"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exchange</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ''}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an exchange" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SUPPORTED_EXCHANGES.map((ex) => (
                        <SelectItem key={ex.id} value={ex.id}>
                          {ex.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    value={field.value || ''}
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="max_position_size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Position Size</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="0.01"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Maximum position size in base currency (e.g., BTC)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stoploss_percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stoploss Percentage</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="5"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? parseFloat(e.target.value) : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Optional: Set a stoploss percentage (e.g., 5 for 5%)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Your API Key" 
                      {...field} 
                      value={field.value || ''} 
                    />
                  </FormControl>
                  <FormDescription>
                    Your exchange API key
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="api_secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Secret</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="Your API Secret" 
                      {...field} 
                      value={field.value || ''} 
                    />
                  </FormControl>
                  <FormDescription>Your exchange API secret.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating Bot...' : 'Create Bot'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
