import { vi } from 'vitest'

// All tests are offline, including legacy credential-gated exchange tests.
vi.mock('ccxt', () => ({
  bitget: vi.fn(function () { return { id: 'bitget' } }),
  hyperliquid: vi.fn(function () { return { id: 'hyperliquid' } }),
}))
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => { throw new Error('Supabase is disabled in offline tests') }),
  createBrowserClient: vi.fn(() => { throw new Error('Supabase is disabled in offline tests') }),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => { throw new Error('Supabase is disabled in offline tests') }),
}))
