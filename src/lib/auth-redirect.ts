/** Only allow local app destinations, avoiding external redirects and auth loops. */
export function authDestination(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\s]/.test(next)) return '/dashboard'
  // Match browser dot-segment normalization, including percent-encoded dots.
  // The fixed base is used only to parse local destinations; no request is made.
  const pathname = new URL(next, 'https://tradebot.invalid').pathname
  if (pathname === '/auth' || pathname.startsWith('/auth/')) return '/dashboard'
  return next
}
