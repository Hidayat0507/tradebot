import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('database client env check is lazy', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })
  afterEach(() => { process.env = { ...saved } })

  it('imports without env vars and throws ConfigError only when used', async () => {
    const mod = await import('@/lib/database/client')
    mod.__resetSupabaseForTests()
    expect(() => mod.getSupabase()).toThrow(mod.ConfigError)
  })

  it('operations module imports without env vars', async () => {
    await expect(import('@/lib/database/operations')).resolves.toBeDefined()
  })
})
