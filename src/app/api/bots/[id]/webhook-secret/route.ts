import { NextRequest } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import {
  getBotWithOwnership,
  handleApiError,
  successResponse,
  ApiError
} from '@/app/api/_middleware/api-handler';
import { logger, normalizeError } from '@/lib/logging';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { supabase, user } = await getBotWithOwnership(request, id);
    
    // Generate webhook secret and hash for storage
    const webhookSecret = randomBytes(32).toString('hex');
    const webhookSecretHash = 'sha256:' + createHash('sha256').update(webhookSecret).digest('hex');

    // Update the bot
    const { error } = await supabase
      .from('bots')
      .update({ 
        webhook_secret: webhookSecretHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      logger.error('Failed to update webhook secret', normalizeError(error), { botId: id, userId: user.id });
      throw new ApiError('Failed to update webhook secret', 500);
    }

    logger.info('Webhook secret regenerated', { botId: id, userId: user.id });
    // Return the new webhook secret directly (plaintext shown once)
    return successResponse({ webhook_secret: webhookSecret });
  } catch (error) {
    return handleApiError(error);
  }
}
