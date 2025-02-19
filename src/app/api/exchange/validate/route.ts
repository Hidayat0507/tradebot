import { NextResponse } from 'next/server'
import ccxt from 'ccxt'

const SUPPORTED_EXCHANGES = ['binance', 'coinbase', 'kraken'] as const
type SupportedExchange = typeof SUPPORTED_EXCHANGES[number]

export async function POST(request: Request) {
  try {
    const { apiKey, apiSecret, exchange = 'binance' } = await request.json()

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ 
        success: false, 
        error: 'API key and secret are required' 
      }, { status: 400 })
    }

    if (!SUPPORTED_EXCHANGES.includes(exchange as SupportedExchange)) {
      return NextResponse.json({ 
        success: false, 
        error: `Exchange ${exchange} is not supported. Supported exchanges: ${SUPPORTED_EXCHANGES.join(', ')}` 
      }, { status: 400 })
    }

    // Initialize exchange client
    const exchangeClient = new ccxt[exchange as SupportedExchange]({
      apiKey,
      secret: apiSecret,
      enableRateLimit: true
    })

    // Test API connection
    try {
      await exchangeClient.fetchBalance()
      return NextResponse.json({ 
        success: true,
        message: 'API credentials validated successfully'
      })
    } catch (error: any) {
      return NextResponse.json({ 
        success: false,
        error: error.message || 'Invalid API credentials'
      }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Exchange validation error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Failed to validate exchange credentials'
    }, { status: 500 })
  }
}
