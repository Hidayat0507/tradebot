# Bitget Balance Test

This directory contains a test script to debug Bitget balance fetching issues.

## Setup

1. **Add your Bitget API credentials to `.env.local`:**

```bash
TEST_BITGET_API_KEY=your_bitget_api_key
TEST_BITGET_API_SECRET=your_bitget_api_secret
TEST_BITGET_PASSWORD=your_bitget_passphrase
```

> ⚠️ **Note:** These are separate test variables. Your existing bot credentials won't be used.

## Run the Test

```bash
npx tsx scripts/test-bitget-balance.ts
```

Or with bun:

```bash
bun scripts/test-bitget-balance.ts
```

## What the Test Does

The script will test 4 different ways of fetching balance:

1. ✅ `fetchBalance()` - No parameters (default)
2. ✅ `fetchBalance({ type: 'spot' })` - Spot trading account
3. ✅ `fetchBalance({ type: 'swap' })` - Perpetual swaps account
4. ✅ `fetchBalance({ type: 'futures' })` - Futures account

## Expected Output

If successful, you'll see:

```
🧪 Testing Bitget Balance Fetch
==================================================
✓ Credentials found
  API Key: bg_xxxxxx...
  Password: abc...

📡 Creating Bitget client...
✓ Client created successfully

Test 1: fetchBalance() - no params
--------------------------------------------------
✅ SUCCESS
  Currencies found: 3
  Total balances: {
    "USDT": 100.5,
    "BTC": 0.001,
    ...
  }
...
```

## Common Errors

### Authentication Error
```
❌ AuthenticationError: Invalid API credentials
```

**Solutions:**
- Check your API Key, Secret, and Password are correct
- Ensure API key has "Read" permission enabled
- Check if IP whitelist is configured (add your IP if enabled)

### Permission Denied
```
❌ PermissionDenied: API key does not have required permissions
```

**Solutions:**
- Go to Bitget → API Management
- Edit your API key
- Enable "Read" permission
- Save and try again

### No Balance Returned
```
✅ SUCCESS
  Currencies found: 0
  Total balances: {}
```

**This is normal if:**
- You have no assets in that account type (spot/swap/futures)
- Try the other account types

## Understanding Results

- **Test 1 succeeds** → Basic authentication works, issue might be with parameters
- **All tests fail** → Authentication issue (check credentials)
- **Some tests succeed** → You only have funds in certain account types

## Next Steps

After running the test:

1. **If all tests pass** → The issue is in your application code, not with Bitget API
2. **If a specific type works** → You may need to add `getBalanceParams` to return that type
3. **If all fail** → Check your API credentials and permissions

## Need Help?

Share the test output to help diagnose the issue!


