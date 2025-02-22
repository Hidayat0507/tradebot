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
import { createClient } from '@/utils/supabase/client'
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
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const supabase = createClient()
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
        const { data, error } = await supabase
          .from('exchange_config')
          .select('*')
          .single()

        if (error) {
          console.error('Error loading config:', error)
          return
        }

        if (data) {
          form.setValue('exchange', data.exchange)
          form.setValue('apiKey', data.api_key)
          form.setValue('apiSecret', data.api_secret)
        }
      } catch (error) {
        console.error('Failed to load exchange config:', error)
      }
    }

    loadExistingConfig()
  }, [router])

  async function onSubmit(data: ExchangeFormValues) {
    try {
      setError(null)
      setSuccess(null)

      // Validate API credentials
      const response = await fetch('/api/exchange/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exchange: data.exchange,
          apiKey: data.apiKey,
          apiSecret: data.apiSecret,
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
          exchange: data.exchange,
          api_key: data.apiKey,
          api_secret: data.apiSecret,
        })

      if (dbError) throw dbError

      setIsValidated(true)
      onValidated(data)
    } catch (error) {
      console.error('Failed to save exchange config:', error)
      setError(error instanceof Error ? error.message : 'Failed to save exchange configuration')
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

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 text-green-700 border-green-200">
            <AlertDescription>
              {success}
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
