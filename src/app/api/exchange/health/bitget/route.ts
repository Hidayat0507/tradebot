import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { bitgetPlugin } from '@/lib/exchanges/bitget'
import type { ResolvedExchangeCredentials } from '@/lib/exchanges/types'

function normalizeSymbol(symbol: string | null | undefined): string | undefined {
  if (!symbol) return undefined
  const s = symbol.toUpperCase()
  return s.endsWith(':USDT') ? s : `${s}:USDT`
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const symbolParam = url.searchParams.get('symbol')
    const apiKey = url.searchParams.get('apiKey')
    const apiSecret = url.searchParams.get('apiSecret')
    const password = url.searchParams.get('password')

    if (!apiKey || !password) {
      return NextResponse.json({ error: 'Missing required credentials' }, { status: 400 })
    }

    const credentials: ResolvedExchangeCredentials = {
      apiKey,
      apiSecret: apiSecret || '',
      password
    }

    const client = await bitgetPlugin.createClient(credentials)

    const symbol = normalizeSymbol(symbolParam)
    if (symbol) {
      try {
        const ticker = await client.fetchTicker(symbol)
        return NextResponse.json({ status: 'ok', symbol, last: ticker.last ?? null })
      } catch {
        // fall through to generic success if symbol invalid
      }
    }

    const balance = await client.fetchBalance()
    return NextResponse.json({ status: 'ok', currencies: Object.keys(balance.total || {}).length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


