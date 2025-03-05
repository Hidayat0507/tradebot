import { z } from 'zod'

export const botSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  exchange: z.enum(['binance', 'hyperliquid']),
  pair: z.string().min(1, 'Trading pair is required'),
  max_position_size: z.number().positive('Position size must be positive'),
  stoploss_percentage: z.number().optional(),
  enabled: z.boolean().default(false),
  api_key: z.string().min(1, 'API key is required'),
  api_secret: z.string().min(1, 'API secret is required')
})

export type BotFormData = z.infer<typeof botSchema>
