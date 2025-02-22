'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from '@/lib/database/client'
import type { SupportedExchange } from '@/types'
import { exchangeFormSchema, type ExchangeFormValues } from '@/lib/validations/exchange'

interface ExchangeSetupTabProps {
  onValidated: (config: { exchange: SupportedExchange; apiKey: string; apiSecret: string }) => void
}

const SUPPORTED_EXCHANGES = [
  { id: 'binance', name: 'Binance' },
  { id: 'coinbase', name: 'Coinbase' },
  { id: 'kraken', name: 'Kraken' },
] as const

export default function ExchangeSetupTab({ onValidated }: ExchangeSetupTabProps) {
  const router = useRouter()
  const [isValidated, setIsValidated] = useState(false)
  const form = useForm<ExchangeFormValues>({
    resolver: zodResolver(exchangeFormSchema),
    defaultValues: {
      exchange: 'binance',
      apiKey: '',
      apiSecret: '',
    },
  })

  useEffect(() => {
    async function loadExistingConfig() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          router.push('/auth')
          return
        }

        const { data, error } = await supabase
          .from('exchange_config')
          .select('exchange, api_key, api_secret')
          .eq('user_id', session.user.id)
          .maybeSingle()

        if (error) throw error

        if (data) {
          form.reset({
            exchange: data.exchange as SupportedExchange,
            apiKey: data.api_key,
            apiSecret: data.api_secret,
          })
        }
      } catch (error) {
        console.error('Failed to load exchange config:', error)
      }
    }

    loadExistingConfig()
  }, [router])

  async function onSubmit(values: ExchangeFormValues) {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        router.push('/auth')
        return
      }

      // Validate API credentials
      const response = await fetch('/api/exchange/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exchange: values.exchange,
          apiKey: values.apiKey,
          apiSecret: values.apiSecret,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to validate API credentials')
      }

      // Save to database
      const { error: dbError } = await supabase
        .from('exchange_config')
        .upsert({
          user_id: session.user.id,
          exchange: values.exchange,
          api_key: values.apiKey,
          api_secret: values.apiSecret,
        })

      if (dbError) throw dbError

      setIsValidated(true)
      onValidated(values)
    } catch (error) {
      console.error('Failed to save exchange config:', error)
      form.setError('root', {
        type: 'manual',
        message: error instanceof Error ? error.message : 'Failed to save exchange configuration',
      })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="exchange"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Exchange</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an exchange" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SUPPORTED_EXCHANGES.map((exchange) => (
                    <SelectItem key={exchange.id} value={exchange.id}>
                      {exchange.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Choose your preferred cryptocurrency exchange
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="apiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Key</FormLabel>
              <FormControl>
                <Input {...field} type="password" placeholder="Enter your API key" />
              </FormControl>
              <FormDescription>
                Your exchange API key for trading
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="apiSecret"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Secret</FormLabel>
              <FormControl>
                <Input {...field} type="password" placeholder="Enter your API secret" />
              </FormControl>
              <FormDescription>
                Your exchange API secret for trading
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <Alert variant="destructive">
            <AlertDescription>
              {form.formState.errors.root.message}
            </AlertDescription>
          </Alert>
        )}

        {isValidated && (
          <Alert className="bg-green-50 text-green-700 border-green-200">
            <AlertDescription>
              API credentials validated successfully!
            </AlertDescription>
          </Alert>
        )}

        <Button 
          type="submit" 
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? 'Validating...' : 'Validate & Save'}
        </Button>
      </form>
    </Form>
  )
}
