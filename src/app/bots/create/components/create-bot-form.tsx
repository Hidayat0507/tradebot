'use client'
import { friendlyError, requestFailure } from '@/lib/friendly-error'
import { formatBotUsage } from '@/lib/format'
import { ORDER_SIZE } from '@/lib/bot-config'
import { WebhookExample } from '@/components/bot/WebhookExample'

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

const createBotFormSchema = z.object({
  name: z.string().min(3, 'Bot name must be at least 3 characters'),
  exchange: z.enum(['hyperliquid', 'bitget'] as const),
  pair: z.string().min(1, 'Trading pair is required'),
  max_position_size: z.number({ invalid_type_error: 'Enter a percentage' })
    .min(ORDER_SIZE.min, `Order size must be at least ${ORDER_SIZE.min}%`)
    .max(ORDER_SIZE.max, `Order size cannot exceed ${ORDER_SIZE.max}% of balance`),
  stoploss_percentage: z.number()
    .min(0.1, 'Stoploss must be at least 0.1%')
    .max(50, 'Stoploss must be less than 50%')
    .optional(),
  api_key: z.string().min(1, 'API Key is required'),
  api_secret: z.string().optional(),
  password: z.string().optional(),
}).superRefine((values, ctx) => {
  if (values.exchange === 'bitget' && !values.api_secret?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['api_secret'], message: 'API Secret is required for Bitget' })
  }
  if (values.exchange === 'bitget' && !values.password?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: 'API passphrase is required for Bitget' })
  }
})

type CreateBotFormValues = z.infer<typeof createBotFormSchema>

export function CreateBotForm() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null)
  const [showApiSecret, setShowApiSecret] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [botLimit, setBotLimit] = useState<number | null>(null)
  const [currentBotCount, setCurrentBotCount] = useState<number | null>(null)
  const [plan, setPlan] = useState<string>('free')
  const [limitWarning, setLimitWarning] = useState<string | null>(null)
  const [generatedWebhookSecret, setGeneratedWebhookSecret] = useState<string | null>(null)
  const [createdBot, setCreatedBot] = useState<{ id: string; pair: string; orderSizePct: number } | null>(null)
  const [secretCopyStatus, setSecretCopyStatus] = useState<string | null>(null)
  const supabase = createClient()
  const form = useForm<CreateBotFormValues>({
    resolver: zodResolver(createBotFormSchema),
    defaultValues: {
      name: '',
      pair: 'BTC/USDT',
      max_position_size: ORDER_SIZE.default,
      exchange: 'bitget',
      api_key: '',
      api_secret: '',
      password: '',
    },
  })
  const isHyperliquid = form.watch('exchange') === 'hyperliquid'

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
          setLimitWarning(friendlyError(requestFailure(subscriptionResponse.status), 'We could not check your plan limits. Refresh the page before creating a bot.'))
        }

        const { count, error: countError } = await supabase
          .from('bots')
          .select('id', { count: 'exact', head: true })

        if (countError) {
          throw countError
        }

        setCurrentBotCount(typeof count === 'number' && Number.isFinite(count) ? count : null)
      } catch (err) {
        const message = friendlyError(err, 'We could not check your plan limits. Refresh the page before creating a bot.')
        setLimitWarning(message)
      }
    }

    loadUsage()
  }, [supabase])

  async function nextStep() {
    const fields: (keyof CreateBotFormValues)[] = step === 1
      ? ['name', 'exchange', 'pair'] : ['max_position_size', 'stoploss_percentage']
    if (await form.trigger(fields, { shouldFocus: true })) setStep(current => Math.min(3, current + 1))
  }

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
        setError('Please sign in to create a bot.')
        router.push('/auth?next=/bots/create')
        return
      }

      const userId = user.id

      if (!userId) {
        setError('Please sign in to create a bot.')
        router.push('/auth?next=/bots/create')
        return
      }

      if (botLimit !== null && currentBotCount !== null && currentBotCount >= botLimit) {
        setError(`You have reached the ${botLimit} bot limit for the ${plan} plan.`)
        setIsSubmitting(false)
        return
      }

      const creationResponse = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, enabled: false }),
      })
      const creation = await creationResponse.json()
      if (!creationResponse.ok || !creation.success) {
        throw requestFailure(creationResponse.status)
      }
      const botId = creation.data.id
      const webhookSecretPlaintext = creation.data.webhook_secret

      // Step 2: Validate exchange credentials
      const requestBody = {
        botId: botId,
        exchange: values.exchange,
        apiKey: values.api_key,
        apiSecret: values.api_secret,
        password: values.exchange === 'bitget' ? values.password : undefined,
      }

      const response = await fetch('/api/exchange/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      
      try {
        const data = await response.json()

        if (!response.ok) {
          // If validation fails, delete the bot we just created
          await supabase.from('bots').delete().eq('id', botId)
          
          setValidationError(friendlyError(requestFailure(response.status), 'We could not connect your exchange. Check the key, secret, permissions and passphrase, then try again.'))
          setValidationSuccess(null)
          setIsSubmitting(false)
          return
        }

        setValidationSuccess('Exchange credentials validated successfully!')
        setValidationError(null)
        setSuccess('Bot created successfully! Copy your webhook secret below before leaving this page.')
        setGeneratedWebhookSecret(webhookSecretPlaintext)
        setCreatedBot({ id: botId, pair: values.pair, orderSizePct: values.max_position_size })
        setSecretCopyStatus(null)
      } catch (error: any) {
        // If something goes wrong, delete the bot we just created
        await supabase.from('bots').delete().eq('id', botId)
        
        setError(friendlyError(error, 'We could not check your exchange connection. Please try again.'))
      } finally {
        setIsSubmitting(false)
      }
    } catch (error: any) {
      setError(friendlyError(error, 'We could not create your bot. Please try again.'))
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
            {formatBotUsage(currentBotCount, botLimit, plan)}
            {currentBotCount !== null && currentBotCount >= botLimit ? ' Upgrade your plan to add more bots.' : ''}
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
        <form onSubmit={(event) => {
          if (step < 3) { event.preventDefault(); void nextStep(); return }
          void form.handleSubmit(onSubmit, (errors) => {
            if (errors.name || errors.exchange || errors.pair) setStep(1)
            else if (errors.max_position_size || errors.stoploss_percentage) setStep(2)
          })(event)
        }} className="space-y-6">
          <ol aria-label="Create bot progress" className="grid grid-cols-3 gap-2 text-sm">
            {['Bot basics', 'Risk settings', 'Connect exchange'].map((label, index) => (
              <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={`rounded-lg border p-2 ${step === index + 1 ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                {index + 1}. {label}
              </li>
            ))}
          </ol>
          <fieldset hidden={step !== 1} className="space-y-4">
            <legend className="sr-only">Bot basics</legend>
            <div>
              <h3 className="text-lg font-semibold mb-2">1. Bot basics</h3>
              <p className="text-sm text-gray-500">
                Choose a name, exchange and trading pair. Your bot will be created paused.
              </p>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. BTC EMA Cross" {...field} value={field.value || ''} />
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

          </fieldset>
          <fieldset hidden={step !== 2} className="space-y-4">
            <legend className="text-lg font-semibold">2. Risk settings</legend>
            <p className="text-sm text-gray-500">Decide how much balance each order can use. Examples below are illustrative, not your account balance.</p>
            <FormField
              control={form.control}
              name="max_position_size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{ORDER_SIZE.label}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min={ORDER_SIZE.min}
                      max={ORDER_SIZE.max}
                      placeholder={String(ORDER_SIZE.default)}
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    {ORDER_SIZE.help}
                    {Number.isFinite(form.watch('max_position_size')) && <> For example, {form.watch('max_position_size')}% of an available 1,000 USDT balance is {(form.watch('max_position_size') * 10).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT per buy order, before fees. This is order size, not a limit on total losses.</>}
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
                  <FormLabel>Stop-loss (%)</FormLabel>
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
                    Optional: a 5% stop-loss on a buy at $100 targets an exit around $95. This saved setting alone does not place a stop order: your TradingView alert must include stoplossPercent and your exchange must support it. Actual execution can differ; losses are not guaranteed to stop at this amount.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

          </fieldset>
          <fieldset hidden={step !== 3} className="space-y-4">
            <legend className="text-lg font-semibold">3. Connect your exchange</legend>
            <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
              {isHyperliquid ? (
                <p>Open the API section in Hyperliquid to create and authorize a dedicated API wallet. Enter your trading account&apos;s public address below and the API wallet&apos;s private key in the next field. <a className="text-blue-500 underline" href="https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint#approve-an-api-wallet" target="_blank" rel="noopener noreferrer">Hyperliquid API wallet guide</a></p>
              ) : (
                <p>Sign in to Bitget and open API Key Management. Create a system-generated key, save its secret and the passphrase you choose, then enter all three below. Enable Read and Trade permissions for trading; leave Withdraw and Transfer disabled. <a className="text-blue-500 underline" href="https://www.bitget.com/docs/classic/rest-api" target="_blank" rel="noopener noreferrer">Bitget API key guide</a></p>
              )}
            </div>
            <FormField
              control={form.control}
              name="api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isHyperliquid ? 'Wallet address' : 'API Key'}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={isHyperliquid ? 'Your Hyperliquid wallet address' : 'Your API Key'}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    {isHyperliquid
                      ? 'The public wallet address that will trade on Hyperliquid.'
                      : 'Your exchange API key'}
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
                  <FormLabel>{isHyperliquid ? 'API wallet private key' : 'API Secret'}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showApiSecret ? "text" : "password"}
                        placeholder={isHyperliquid ? 'Your API wallet private key' : 'Your API Secret'}
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
                  <FormDescription>
                    {isHyperliquid
                      ? 'The dedicated API wallet private key used to sign orders (optional for balance-only access).'
                      : 'Your exchange API secret.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isHyperliquid && (
              <Alert className="border-amber-400 text-amber-600 dark:border-amber-500/60 dark:text-amber-300">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Use an API wallet, never your main wallet</AlertTitle>
                <AlertDescription>
                  Create a dedicated API wallet in Hyperliquid and paste that wallet&apos;s private key above —
                  never your main wallet&apos;s private key. Keep this key secret: anyone with it can act
                  with the permissions granted to the API wallet.
                </AlertDescription>
              </Alert>
            )}

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
          </fieldset>

          <div className="flex flex-wrap gap-3">
          {step > 1 && <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => setStep(step - 1)}>Back</Button>}
          {step < 3 ? <Button type="button" onClick={() => void nextStep()}>Continue</Button> : <Button
            type="submit"
            disabled={
              isSubmitting ||
              (botLimit !== null && currentBotCount !== null && currentBotCount >= botLimit)
            }
          >
            {isSubmitting ? 'Creating Bot...' : 'Create Bot'}
          </Button>}
          </div>
        </form>
      </Form>

      {generatedWebhookSecret && createdBot && (
        <div className="mt-6 rounded-lg border border-gray-700 p-4">
          <h3 className="mb-3 font-semibold text-gray-100">Connect TradingView</h3>
          <WebhookExample botId={createdBot.id} pair={createdBot.pair} secret={generatedWebhookSecret} orderSizePct={createdBot.orderSizePct} />
        </div>
      )}

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
