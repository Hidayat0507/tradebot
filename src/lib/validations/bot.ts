import * as z from 'zod'

export const botFormSchema = z.object({
  name: z.string()
    .min(3, 'Bot name must be at least 3 characters')
    .max(50, 'Bot name must be less than 50 characters'),
  pair: z.string()
    .min(1, 'Trading pair is required'),
  maxPositionSize: z.number()
    .min(0.0001, 'Position size must be at least 0.0001')
    .max(100000, 'Position size must be less than 100000'),
  stoplossPercentage: z.number()
    .min(0.1, 'Stoploss must be at least 0.1%')
    .max(50, 'Stoploss must be less than 50%')
    .optional(),
  status: z.enum(['active', 'paused', 'stopped'])
    .default('paused'),
})

export type BotFormValues = z.infer<typeof botFormSchema>
