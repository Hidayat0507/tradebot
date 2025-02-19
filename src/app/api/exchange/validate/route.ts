import { NextResponse } from 'next/server'
import { validateExchangeCredentials } from '@/app/api/_middleware/exchange';
import { handleApiError } from '@/app/api/_middleware/error-handler';
import { createApiResponse, createErrorResponse } from '@/app/api/_middleware/response';

export async function POST(request: Request) {
  try {
    const { apiKey, apiSecret } = await request.json();

    if (!apiKey || !apiSecret) {
      return createErrorResponse('API key and secret are required', 400);
    }

    await validateExchangeCredentials(apiKey, apiSecret);
    
    return createApiResponse({
      message: 'API key is valid'
    });
  } catch (error) {
    return handleApiError(error, { route: '/api/exchange/validate' });
  }
}
