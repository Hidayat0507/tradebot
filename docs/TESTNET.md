# Testnet mode

`bots.mode = 'testnet'` sends REAL orders to the exchange sandbox (mock funds) via ccxt `setSandboxMode(true)`.
`src/lib/exchanges/testnet.ts` asserts the client is sandboxed before every order (Hyperliquid: API host must be
`api.hyperliquid-testnet.xyz`; Bitget: demo `sandboxMode`, swap/futures only). Mainnet ticker cache is bypassed.

## Hyperliquid testnet creds
1. Faucet needs a wallet that has deposited on mainnet. Open https://app.hyperliquid-testnet.xyz/drip with that wallet, claim 1,000 mock USDC.
2. On https://app.hyperliquid-testnet.xyz → More → API, create an API (agent) wallet, authorize it, copy its private key. Agent keys can trade, not withdraw.
3. Bot: exchange=hyperliquid, api_key = MAIN wallet address, api_secret = AGENT private key, mode=testnet.
Min order: $10 notional.

## E2E
```
HL_TESTNET_WALLET=0xMain HL_TESTNET_PRIVATE_KEY=0xAgent TESTNET_E2E_BOT_ID=... TESTNET_E2E_WEBHOOK_SECRET=... \
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/testnet-e2e.ts
```
Skips (exit 0) without creds.
