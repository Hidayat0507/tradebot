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
import { logger } from '@/lib/logging'

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
          exchange: (value) => 
            ['binance', 'hyperliquid'].includes(value) || 
            'Invalid exchange. Must be binance or hyperliquid'
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
        logger.error('Failed to encrypt API secret', { error: encryptError, botId: id })
        throw new ApiError('Failed to encrypt API secret', 500)
      }
    }

    const { data: updatedBot, error } = await supabase
      .from('bots')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('Failed to update bot', { error, botId: id, userId: user.id })
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
      logger.error('Failed to delete bot', { error, botId: id, userId: user.id })
      throw new ApiError('Failed to delete bot', 400)
    }

    logger.info('Bot deleted successfully', { botId: id, userId: user.id })
    return successResponse(null, 204)
  } catch (error) {
    return handleApiError(error)
  }
}
