import { z } from 'zod'
import type { SupportedExchange } from '@/types'

export const exchangeFormSchema = z.object({
  exchange: z.enum(['hyperliquid', 'bitget'] as const),
  apiKey: z.string().min(1, 'API Key is required'),
  apiSecret: z.string().min(1, 'API Secret is required'),
})

export type ExchangeFormValues = z.infer<typeof exchangeFormSchema>
