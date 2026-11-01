/** Translate failures without returning server messages, database details or credentials. */
export function friendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const detail = error && typeof error === 'object' ? error as { status?: number; code?: string; name?: string; message?: string } : {}
  const message = typeof detail.message === 'string' ? detail.message.toLowerCase() : ''
  if (detail.code === 'invalid_credentials') return 'The email or password is incorrect. Please try again.'
  if (detail.code === 'email_not_confirmed') return 'Please confirm your email using the link in your inbox, then sign in.'
  if (detail.status === 401 || ['PGRST301', 'PGRST302', 'session_not_found', 'refresh_token_not_found'].includes(detail.code ?? '') || /not authenticated|please sign in|log in again|jwt expired/.test(message)) {
    return 'Your session has ended. Please sign in again.'
  }
  if (detail.status === 403 || detail.code === '42501') return 'You do not have permission to do this. Try signing in with the correct account.'
  if (detail.status === 429 || detail.code === 'over_request_rate_limit' || /rate limit|too many requests/.test(message)) return 'Too many requests. Please wait a moment and try again.'
  if (detail.status === 404 || detail.code === 'PGRST116') return 'This item is no longer available. Refresh the page to see the latest information.'
  if (detail.name === 'AbortError' || detail.name === 'TimeoutError' || /timeout|timed out|failed to fetch|fetch failed|network/.test(message)) return 'We could not connect. Check your connection and try again.'
  return fallback
}

/** Preserve HTTP status for the shared mapping, without copying a server response. */
export function requestFailure(status: number): Error & { status: number } {
  return Object.assign(new Error('Request failed'), { status })
}
