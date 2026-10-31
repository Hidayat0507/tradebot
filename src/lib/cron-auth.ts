import { createHash, timingSafeEqual } from 'crypto'

/** Constant-time Bearer check; fails closed when the secret is unset or shorter than 16 chars. */
export function isAuthorizedCron(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16) return false // fail closed when unset/weak
  const m = /^Bearer (.+)$/.exec(header ?? '')
  if (!m) return false
  const a = createHash('sha256').update(m[1]).digest()
  const b = createHash('sha256').update(secret).digest()
  return timingSafeEqual(a, b)
}
