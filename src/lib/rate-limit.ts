import { NextRequest, NextResponse } from 'next/server'

export interface RateLimiter {
  consume(key: string, limit: number, windowMs: number): Promise<boolean>
}

// Per-process fixed windows. Replace this adapter with a shared store for multiple workers.
export class MemoryRateLimiter implements RateLimiter {
  private entries = new Map<string, { count: number; expires: number }>()
  async consume(key: string, limit: number, windowMs: number) {
    const now = Date.now()
    for (const [id, entry] of this.entries) {
      if (entry.expires <= now) this.entries.delete(id)
    }
    const entry = this.entries.get(key) ?? { count: 0, expires: now + windowMs }
    if (entry.count >= limit) return false
    // Bounded memory: evict the oldest window instead of rejecting every new key.
    if (!this.entries.has(key) && this.entries.size >= 10000) {
      const oldest = this.entries.keys().next().value
      if (oldest !== undefined) this.entries.delete(oldest)
    }
    entry.count++
    this.entries.set(key, entry)
    return true
  }
}

export const rateLimiter: RateLimiter = new MemoryRateLimiter()

export function requestIp(request: NextRequest) {
  // The ingress must overwrite x-forwarded-for; never expose the app directly behind an untrusted proxy.
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
}

export function rateLimitResponse() {
  return NextResponse.json({ error: 'Too many requests' }, {
    status: 429, headers: { 'Retry-After': '60' },
  })
}
