/**
 * Testnet guard. A `testnet` bot must NEVER reach mainnet.
 * - Hyperliquid: ccxt sandbox swaps API URLs to api.hyperliquid-testnet.xyz.
 * - Bitget: ccxt sandbox keeps api.bitget.com but sets options.sandboxMode, which adds the
 *   `paptrading: 1` (demo trading) header. Bitget demo supports swap/futures only.
 */
export class TestnetGuardError extends Error {}

type SandboxClient = {
  id: string
  urls?: { api?: unknown }
  options?: Record<string, unknown>
  setSandboxMode?: (enabled: boolean) => void
}

const HL_TESTNET_HOST = 'api.hyperliquid-testnet.xyz'

function apiUrls(client: SandboxClient): string[] {
  const api = client.urls?.api
  if (typeof api === 'string') return [api]
  if (api && typeof api === 'object') return Object.values(api as Record<string, unknown>).filter((v): v is string => typeof v === 'string')
  return []
}

export function assertTestnetClient(client: SandboxClient): void {
  const id = String(client.id).toLowerCase()
  if (id === 'hyperliquid') {
    const urls = apiUrls(client)
    if (urls.length === 0 || !urls.every((u) => new URL(u).host === HL_TESTNET_HOST)) {
      throw new TestnetGuardError('Testnet guard: Hyperliquid client is not pointed at the testnet API')
    }
    return
  }
  if (id === 'bitget') {
    if (client.options?.sandboxMode !== true) {
      throw new TestnetGuardError('Testnet guard: Bitget client is not in demo (sandbox) mode')
    }
    return
  }
  throw new TestnetGuardError(`Testnet guard: exchange ${client.id} has no supported testnet`)
}

/** Switches a freshly-created ccxt client to sandbox and asserts it. Throws if it can't. */
export function enableTestnet<T extends SandboxClient>(client: T): T {
  if (typeof client.setSandboxMode !== 'function') {
    throw new TestnetGuardError(`Testnet guard: ${client.id} does not support sandbox mode`)
  }
  client.setSandboxMode(true)
  assertTestnetClient(client)
  return client
}
