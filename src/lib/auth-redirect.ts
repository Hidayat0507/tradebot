/** Only allow local app destinations, avoiding external redirects and auth loops. */
export function authDestination(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\s]/.test(next)) return '/dashboard'
  const pathname = next.split(/[?#]/)[0]
  if (pathname === '/auth' || pathname.startsWith('/auth/')) return '/dashboard'
  return next
}
