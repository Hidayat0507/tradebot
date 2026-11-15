import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
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

const mocks = vi.hoisted(() => ({ verifyOtp: vi.fn(), redirect: vi.fn() }))
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { verifyOtp: mocks.verifyOtp } })),
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { GET } from '@/app/auth/confirm/route'

describe('email confirmation destination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyOtp.mockResolvedValue({ error: null })
    // Next redirect ends the request by throwing; preserve that behavior.
    mocks.redirect.mockImplementation((destination: string) => { throw new Error(`redirect:${destination}`) })
  })

  const request = (next?: string, withToken = true) => {
    const url = new URL('http://localhost/auth/confirm')
    if (withToken) {
      url.searchParams.set('token_hash', 'test-confirmation-token')
      url.searchParams.set('type', 'email')
    }
    if (next !== undefined) url.searchParams.set('next', next)
    return new NextRequest(url)
  }

  it.each([
    undefined, 'https://outside.example/path', '//outside.example',
    '/\\outside.example', '/auth', '/auth?next=/bots', '/auth/confirm',
  ])('falls back to dashboard after successful verification for %s', async next => {
    await expect(GET(request(next))).rejects.toThrow('redirect:/dashboard')
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: 'test-confirmation-token', type: 'email' })
    expect(mocks.redirect).toHaveBeenCalledTimes(1)
    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard')
  })

  it('preserves a local app destination and its query', async () => {
    const next = '/bots/create?pair=BTC%2FUSDT'
    await expect(GET(request(next))).rejects.toThrow(`redirect:${next}`)
    expect(mocks.redirect).toHaveBeenCalledWith(next)
  })

  it('returns failed verification to the auth error page', async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { message: 'Invalid token' } })
    await expect(GET(request('/bots'))).rejects.toThrow('redirect:/auth?error=Could not verify email')
    expect(mocks.redirect).toHaveBeenCalledTimes(1)
  })

  it('does not verify or follow next when confirmation parameters are missing', async () => {
    await expect(GET(request('/bots', false))).rejects.toThrow('redirect:/auth?error=Could not verify email')
    expect(mocks.verifyOtp).not.toHaveBeenCalled()
    expect(mocks.redirect).toHaveBeenCalledTimes(1)
  })
})
