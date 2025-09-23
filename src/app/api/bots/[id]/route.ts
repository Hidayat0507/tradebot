import { NextRequest } from 'next/server'
import type { BotFormData } from '@/lib/validations/bot'
import {
  getBotWithOwnership,
  handleApiError,
  successResponse,
  ApiError,
  validateFields
} from '@/app/api/_middleware/api-handler'
import { encrypt } from '@/utils/encryption'
import { logger, normalizeError } from '@/lib/logging'
import { listEnabledExchanges } from '@/lib/exchanges/registry'
import type { SupportedExchange } from '@/lib/database/schema'

const enabledExchangeSet = new Set<SupportedExchange>(
  listEnabledExchanges().map((plugin) => plugin.id)
)

// GET /api/bots/[id] - Get a specific bot's details
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { bot } = await getBotWithOwnership(request, id)
    return successResponse(bot)
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/bots/[id] - Update a bot's settings
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { bot, supabase, user } = await getBotWithOwnership(request, id)
    const body = await request.json() as BotFormData
    
    // Validate update data
    if (body.exchange) {
      validateFields(
        body,
        [],
        {
          exchange: (value: unknown) => {
            if (typeof value !== 'string') {
              return 'Invalid exchange selection'
            }
            const normalized = value.toLowerCase() as SupportedExchange
            return enabledExchangeSet.has(normalized)
              ? true
              : `Invalid exchange. Must be one of ${Array.from(enabledExchangeSet).join(', ')}`
          }
        }
      )
    }

    // Prepare update data
    const updateData = { ...body, updated_at: new Date().toISOString() }
    
    // Encrypt API secret if provided
    if (updateData.api_secret) {
      try {
        updateData.api_secret = await encrypt(updateData.api_secret)
        logger.info('API secret encrypted successfully', { botId: id })
      } catch (encryptError) {
        logger.error('Failed to encrypt API secret', normalizeError(encryptError), { botId: id })
        throw new ApiError('Failed to encrypt API secret', 500)
      }
    }

    // Encrypt password if provided
    if (updateData.password) {
      try {
        updateData.password = await encrypt(updateData.password)
        logger.info('Password encrypted successfully', { botId: id })
      } catch (encryptError) {
        logger.error('Failed to encrypt password', normalizeError(encryptError), { botId: id })
        throw new ApiError('Failed to encrypt password', 500)
      }
    }

    const { data: updatedBot, error } = await supabase
      .from('bots')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('Failed to update bot', normalizeError(error), { botId: id, userId: user.id })
      throw new ApiError('Failed to update bot', 400)
    }

    logger.info('Bot updated successfully', { botId: id, userId: user.id })
    return successResponse(updatedBot)
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/bots/[id] - Delete a bot
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { supabase, user } = await getBotWithOwnership(request, id)
    
    const { error } = await supabase
      .from('bots')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Failed to delete bot', normalizeError(error), { botId: id, userId: user.id })
      throw new ApiError('Failed to delete bot', 400)
    }

    logger.info('Bot deleted successfully', { botId: id, userId: user.id })
    return successResponse(null, 204)
  } catch (error) {
    return handleApiError(error)
  }
}
