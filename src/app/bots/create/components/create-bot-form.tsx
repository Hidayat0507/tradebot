'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { z } from 'zod'

const SUPPORTED_EXCHANGES = [
  { id: 'bitget', name: 'Bitget' },
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

const BYTE_TO_HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'))

function getWebCrypto(): Crypto {
  const crypto = typeof globalThis !== 'undefined'
    ? (globalThis.crypto || (globalThis as unknown as { msCrypto?: Crypto }).msCrypto)
    : undefined

  if (!crypto || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure random number generation is not supported in this environment')
  }

  return crypto
}

function bytesToHex(bytes: Uint8Array, uppercase = false) {
  const hex = Array.from(bytes, (byte) => BYTE_TO_HEX[byte]).join('')
  return uppercase ? hex.toUpperCase() : hex
}

function generateClientBotId() {
  const crypto = getWebCrypto()
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes, true)
}

async function generateWebhookSecret() {
  const crypto = getWebCrypto()
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const plain = bytesToHex(bytes)

  if (!crypto.subtle || typeof crypto.subtle.digest !== 'function') {
    throw new Error('Secure hashing is not supported in this environment')
  }

  const encoded = new TextEncoder().encode(plain)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  const hashHex = bytesToHex(new Uint8Array(digest))

  return {
    plain,
    hashed: `sha256:${hashHex}`,
  }
}

const createBotFormSchema = z.object({
  name: z.string().min(3, 'Bot name must be at least 3 characters'),
  exchange: z.enum(['hyperliquid', 'bitget'] as const),
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
  password: z.string().optional(),
})

type CreateBotFormValues = z.infer<typeof createBotFormSchema>

export function CreateBotForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null)
  const [showApiSecret, setShowApiSecret] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [botLimit, setBotLimit] = useState<number | null>(null)
  const [currentBotCount, setCurrentBotCount] = useState(0)
  const [plan, setPlan] = useState<string>('free')
  const [limitWarning, setLimitWarning] = useState<string | null>(null)
  const [generatedWebhookSecret, setGeneratedWebhookSecret] = useState<string | null>(null)
  const [secretCopyStatus, setSecretCopyStatus] = useState<string | null>(null)
  const supabase = createClient()
  const form = useForm<CreateBotFormValues>({
    resolver: zodResolver(createBotFormSchema),
    defaultValues: {
      name: '',
      pair: 'BTC/USDT',
      max_position_size: 0.01,
      exchange: 'bitget',
      api_key: '',
      api_secret: '',
      password: '',
    },
  })

  useEffect(() => {
    async function loadUsage() {
      try {
        setLimitWarning(null)

        const subscriptionResponse = await fetch('/api/subscription', { cache: 'no-store' })
        const subscriptionPayload = await subscriptionResponse.json()

        if (subscriptionResponse.ok && subscriptionPayload?.success && subscriptionPayload?.data) {
          const { limit, plan: planName } = subscriptionPayload.data as {
            limit: number | null
            plan: string
          }
          setBotLimit(limit)
          setPlan(planName)
        } else if (subscriptionPayload?.error) {
          setLimitWarning(subscriptionPayload.error)
        }

        const { count, error: countError } = await supabase
          .from('bots')
          .select('id', { count: 'exact', head: true })

        if (countError) {
          throw countError
        }

        setCurrentBotCount(count ?? 0)
      } catch (err) {
        console.error('Failed to load bot usage limits', err)
        const message = err instanceof Error ? err.message : 'Unable to load bot usage limits'
        setLimitWarning(message)
      }
    }

    loadUsage()
  }, [supabase])

  async function onSubmit(values: CreateBotFormValues) {
    try {
      setIsSubmitting(true)
      setError(null)
      setSuccess(null)
      setValidationError(null)
      setValidationSuccess(null)
      setGeneratedWebhookSecret(null)
      setSecretCopyStatus(null)

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

      if (botLimit !== null && currentBotCount >= botLimit) {
        setError(`You have reached the ${botLimit} bot limit for the ${plan} plan.`)
        setIsSubmitting(false)
        return
      }

      // Generate a unique ID for the bot
      const botId = generateClientBotId()

      // Generate a webhook secret
      const { plain: webhookSecretPlaintext, hashed: webhookSecretHash } = await generateWebhookSecret()

      // Step 1: Create the bot first with placeholder values
      const { error: botError } = await supabase
        .from('bots')
        .insert({
          id: botId,
          user_id: userId,
          name: values.name,
          exchange: values.exchange,
          pair: values.pair, // keep CCXT symbol format with slash
          max_position_size: values.max_position_size,
          stoploss_percentage: values.stoploss_percentage,
          enabled: false,
          // Add placeholder values that will be replaced after validation
          api_key: 'pending_validation',
          api_secret: 'pending_validation',
          webhook_secret: webhookSecretHash, // Store hashed secret immediately
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
        password: values.exchange === 'bitget' ? values.password : undefined,
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
        setSuccess('Bot created successfully! Copy your webhook secret below before leaving this page.')
        setGeneratedWebhookSecret(webhookSecretPlaintext)
        setSecretCopyStatus(null)
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

      {limitWarning && (
        <Alert className="border-amber-400 text-amber-600 dark:border-amber-500/60 dark:text-amber-300">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Usage information unavailable</AlertTitle>
          <AlertDescription>{limitWarning}</AlertDescription>
        </Alert>
      )}

      {plan === 'admin' ? (
        <Alert className="border-blue-300 text-blue-700 dark:border-blue-500/40 dark:text-blue-300">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Unlimited access</AlertTitle>
          <AlertDescription>
            You can create unlimited bots with your admin access.
          </AlertDescription>
        </Alert>
      ) : botLimit !== null ? (
        <Alert className="border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-200">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Plan usage</AlertTitle>
          <AlertDescription>
            You are using {currentBotCount} of {botLimit} bots on the {plan} plan.
            {currentBotCount >= botLimit ? ' Upgrade your plan to add more bots.' : ''}
          </AlertDescription>
        </Alert>
      ) : null}

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
                    <div className="relative">
                      <Input 
                        type={showApiSecret ? "text" : "password"}
                        placeholder="Your API Secret" 
                        {...field} 
                        value={field.value || ''} 
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        tabIndex={-1}
                        onClick={() => setShowApiSecret((v) => !v)}
                        aria-label={showApiSecret ? 'Hide API Secret' : 'Show API Secret'}
                      >
                        {showApiSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormDescription>Your exchange API secret.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch('exchange') === 'bitget' && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password (API Passphrase)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Your Bitget API Passphrase"
                          {...field}
                          value={field.value || ''}
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          tabIndex={-1}
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Hide Password' : 'Show Password'}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Your Bitget API passphrase (sometimes called password).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          <Button
            type="submit"
            disabled={
              isSubmitting ||
              (botLimit !== null && currentBotCount >= botLimit)
            }
          >
            {isSubmitting ? 'Creating Bot...' : 'Create Bot'}
          </Button>
        </form>
      </Form>

      {generatedWebhookSecret && (
        <Alert className="mt-6 border-blue-200 text-blue-700 dark:border-blue-500/60 dark:text-blue-200">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Webhook Secret Generated</AlertTitle>
          <AlertDescription>
            <div className="space-y-3">
              <p>Your webhook secret is shown below and will only be displayed once. Copy it before navigating away.</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 text-sm">{generatedWebhookSecret}</code>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(generatedWebhookSecret)
                        setSecretCopyStatus('Webhook secret copied to clipboard.')
                      } else {
                        throw new Error('Clipboard API unavailable')
                      }
                    } catch {
                      window.prompt('Copy your webhook secret:', generatedWebhookSecret)
                      setSecretCopyStatus('Copy the secret manually if it did not copy automatically.')
                    }
                  }}
                >
                  Copy Secret
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => router.push('/bots')}
                >
                  Go to Bots
                </Button>
              </div>
              {secretCopyStatus && (
                <p className="text-sm text-blue-600 dark:text-blue-300">{secretCopyStatus}</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
