import { describe, expect, it } from 'vitest'
import { authDestination } from '@/lib/auth-redirect'

describe('post-sign-in destination', () => {
  it('defaults to dashboard and preserves local next paths and queries', () => {
    expect(authDestination(null)).toBe('/dashboard')
    expect(authDestination('/bots/create?pair=BTC%2FUSDT')).toBe('/bots/create?pair=BTC%2FUSDT')
  })
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/auth', '/auth?next=/bots', '/auth/login', '/\nevil'])('rejects external destinations and auth loops: %s', next => {
    expect(authDestination(next)).toBe('/dashboard')
  })
})
