/**
 * Bitget Balance Fetch Test
 * 
 * This test helps debug Bitget balance fetching issues.
 * To run: npm test src/test/bitget-balance.test.ts
 * 
 * IMPORTANT: Add your credentials to .env.local:
 * TEST_BITGET_API_KEY=your_api_key
 * TEST_BITGET_API_SECRET=your_api_secret
 * TEST_BITGET_PASSWORD=your_password
 */

import { describe, it, expect } from 'vitest'
import { bitgetPlugin } from '@/lib/exchanges/bitget'

describe('Bitget Balance Fetching', () => {
  const apiKey = process.env.TEST_BITGET_API_KEY
  const apiSecret = process.env.TEST_BITGET_API_SECRET
  const password = process.env.TEST_BITGET_PASSWORD

  // Skip tests if credentials not provided
  const testIf = apiKey && apiSecret && password ? it : it.skip

  testIf('should create Bitget client successfully', async () => {
    const client = await bitgetPlugin.createClient({
      apiKey: apiKey!,
      apiSecret: apiSecret!,
      password: password!,
    })

    expect(client).toBeDefined()
    expect(client.id).toBe('bitget')
  })

  testIf('should fetch balance without params', async () => {
    const client = await bitgetPlugin.createClient({
      apiKey: apiKey!,
      apiSecret: apiSecret!,
      password: password!,
    })

    const balance = await client.fetchBalance()
    
    console.log('Balance without params:', {
      currencies: Object.keys(balance.total || {}).length,
      total: balance.total,
      free: balance.free,
      used: balance.used,
    })

    expect(balance).toBeDefined()
    expect(balance.total).toBeDefined()
  })

  testIf('should fetch balance with type: spot', async () => {
    const client = await bitgetPlugin.createClient({
      apiKey: apiKey!,
      apiSecret: apiSecret!,
      password: password!,
    })

    const balance = await client.fetchBalance({ type: 'spot' })
    
    console.log('Balance with type spot:', {
      currencies: Object.keys(balance.total || {}).length,
      total: balance.total,
    })

    expect(balance).toBeDefined()
    expect(balance.total).toBeDefined()
  })

  testIf('should fetch balance with type: swap', async () => {
    const client = await bitgetPlugin.createClient({
      apiKey: apiKey!,
      apiSecret: apiSecret!,
      password: password!,
    })

    const balance = await client.fetchBalance({ type: 'swap' })
    
    console.log('Balance with type swap:', {
      currencies: Object.keys(balance.total || {}).length,
      total: balance.total,
    })

    expect(balance).toBeDefined()
    expect(balance.total).toBeDefined()
  })

  testIf('should test getBalanceParams if defined', () => {
    if (bitgetPlugin.getBalanceParams) {
      const params = bitgetPlugin.getBalanceParams({
        apiKey: apiKey!,
        apiSecret: apiSecret!,
        password: password!,
      })
      
      console.log('getBalanceParams returned:', params)
      
      expect(params).toBeDefined()
    } else {
      console.log('getBalanceParams is not defined - will use undefined params')
    }
  })

  // Manual test guide
  it('should provide manual test instructions', () => {
    if (!apiKey || !apiSecret || !password) {
      console.log('\n⚠️  Bitget tests skipped - credentials not provided')
      console.log('\nTo run these tests, add to .env.local:')
      console.log('TEST_BITGET_API_KEY=your_api_key')
      console.log('TEST_BITGET_API_SECRET=your_api_secret')
      console.log('TEST_BITGET_PASSWORD=your_password')
      console.log('\nThen run: npm test src/test/bitget-balance.test.ts\n')
    }
    expect(true).toBe(true)
  })
})

