/**
 * Simple Bitget Balance Test Script
 * 
 * Run with: npx tsx scripts/test-bitget-balance.ts
 * 
 * This script tests if Bitget balance fetching works with your credentials.
 */

import * as ccxt from 'ccxt'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const apiKey = process.env.TEST_BITGET_API_KEY
const apiSecret = process.env.TEST_BITGET_API_SECRET
const password = process.env.TEST_BITGET_PASSWORD

async function testBitgetBalance() {
  console.log('🧪 Testing Bitget Balance Fetch\n')
  console.log('=' .repeat(50))
  
  if (!apiKey || !apiSecret || !password) {
    console.error('❌ Missing credentials!\n')
    console.log('Please add to your .env.local file:')
    console.log('TEST_BITGET_API_KEY=your_api_key')
    console.log('TEST_BITGET_API_SECRET=your_api_secret')
    console.log('TEST_BITGET_PASSWORD=your_password')
    process.exit(1)
  }

  console.log('✓ Credentials found')
  console.log(`  API Key: ${apiKey.substring(0, 10)}...`)
  console.log(`  Password: ${password.substring(0, 3)}...\n`)

  try {
    // Create Bitget client
    console.log('📡 Creating Bitget client...')
    const exchange = new ccxt.bitget({
      apiKey,
      secret: apiSecret,
      password,
      enableRateLimit: true,
    })
    console.log('✓ Client created successfully\n')

    // Test 1: Fetch balance without params (default behavior)
    console.log('Test 1: fetchBalance() - no params')
    console.log('-'.repeat(50))
    try {
      const balance1 = await exchange.fetchBalance()
      console.log('✅ SUCCESS')
      console.log('  Currencies found:', Object.keys(balance1.total || {}).length)
      console.log('  Total balances:', JSON.stringify(balance1.total, null, 2))
      console.log('  Free balances:', JSON.stringify(balance1.free, null, 2))
      console.log()
    } catch (err: any) {
      console.log('❌ FAILED')
      console.log('  Error:', err.message)
      console.log()
    }

    // Test 2: Fetch balance with type: 'spot'
    console.log('Test 2: fetchBalance({ type: "spot" })')
    console.log('-'.repeat(50))
    try {
      const balance2 = await exchange.fetchBalance({ type: 'spot' })
      console.log('✅ SUCCESS')
      console.log('  Currencies found:', Object.keys(balance2.total || {}).length)
      console.log('  Total balances:', JSON.stringify(balance2.total, null, 2))
      console.log()
    } catch (err: any) {
      console.log('❌ FAILED')
      console.log('  Error:', err.message)
      console.log()
    }

    // Test 3: Fetch balance with type: 'swap'
    console.log('Test 3: fetchBalance({ type: "swap" })')
    console.log('-'.repeat(50))
    try {
      const balance3 = await exchange.fetchBalance({ type: 'swap' })
      console.log('✅ SUCCESS')
      console.log('  Currencies found:', Object.keys(balance3.total || {}).length)
      console.log('  Total balances:', JSON.stringify(balance3.total, null, 2))
      console.log()
    } catch (err: any) {
      console.log('❌ FAILED')
      console.log('  Error:', err.message)
      console.log()
    }

    // Test 4: Fetch balance with type: 'futures'
    console.log('Test 4: fetchBalance({ type: "futures" })')
    console.log('-'.repeat(50))
    try {
      const balance4 = await exchange.fetchBalance({ type: 'futures' })
      console.log('✅ SUCCESS')
      console.log('  Currencies found:', Object.keys(balance4.total || {}).length)
      console.log('  Total balances:', JSON.stringify(balance4.total, null, 2))
      console.log()
    } catch (err: any) {
      console.log('❌ FAILED')
      console.log('  Error:', err.message)
      console.log()
    }

    console.log('=' .repeat(50))
    console.log('✅ Tests completed!\n')

  } catch (error: any) {
    console.error('\n❌ Fatal Error:')
    console.error('  Message:', error.message)
    if (error.constructor.name === 'AuthenticationError') {
      console.error('\n  This is an authentication error.')
      console.error('  Please check:')
      console.error('  - API Key is correct')
      console.error('  - API Secret is correct')
      console.error('  - Password/Passphrase is correct')
      console.error('  - API key has "Read" permissions')
      console.error('  - IP whitelist includes your current IP (if enabled)')
    }
    console.error('\n  Stack:', error.stack)
    process.exit(1)
  }
}

// Run the test
testBitgetBalance()


