/**
 * Webhook secrets are stored hashed (`sha256:<hex>`). The plaintext exists only in the response
 * to create/regenerate and must be shown exactly once. Never display or copy the stored value.
 */
export type SecretDisplay =
  | { kind: 'fresh'; value: string }   // just generated in this session: show + copy
  | { kind: 'hidden' }                 // stored hashed: not recoverable, offer regenerate
  | { kind: 'missing' }                // no secret at all: must generate

export function secretDisplay(stored: string | null | undefined, freshPlaintext: string | null | undefined): SecretDisplay {
  if (freshPlaintext && !freshPlaintext.startsWith('sha256:')) return { kind: 'fresh', value: freshPlaintext }
  if (!stored) return { kind: 'missing' }
  return { kind: 'hidden' }
}

/** Value to put into the alert example: the fresh plaintext, else a placeholder. Never the hash. */
export function secretForExample(d: SecretDisplay): string {
  return d.kind === 'fresh' ? d.value : 'YOUR_WEBHOOK_SECRET'
}
