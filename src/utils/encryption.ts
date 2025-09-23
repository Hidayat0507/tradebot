import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Simple and secure strategy:
// - AES-256-GCM (authenticated encryption)
// - Single 32-byte key provided via ENCRYPTION_KEY env (base64 or hex)
// - Random 12-byte IV per message
// - Output format: v1:<iv_base64>:<cipher_base64>:<tag_base64>

const ALGO_GCM = 'aes-256-gcm'
const V1_PREFIX = 'v1'

function parseKeyFromEnv(): Buffer {
  const keyRaw = process.env.ENCRYPTION_KEY
  if (!keyRaw) {
    throw new Error('ENCRYPTION_KEY is required (32-byte key in base64 or hex)')
  }

  // Try base64 first, then hex
  try {
    const b64 = Buffer.from(keyRaw, 'base64')
    if (b64.length === 32) return b64
  } catch {}

  try {
    const hex = Buffer.from(keyRaw, 'hex')
    if (hex.length === 32) return hex
  } catch {}

  throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes (base64 or hex)')
}

function getKey(): Buffer {
  return parseKeyFromEnv()
}

export async function encrypt(text: string): Promise<string> {
  if (!text) return ''

  const key = getKey()
  // 12-byte IV recommended for GCM
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO_GCM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  const ivB64 = iv.toString('base64')
  const ctB64 = ciphertext.toString('base64')
  const tagB64 = tag.toString('base64')

  return `${V1_PREFIX}:${ivB64}:${ctB64}:${tagB64}`
}

export async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText) return ''

  // Modern format: v1:<iv_b64>:<ct_b64>:<tag_b64>
  if (encryptedText.startsWith(`${V1_PREFIX}:`)) {
    const parts = encryptedText.split(':')
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted text format (v1)')
    }
    const [, ivB64, ctB64, tagB64] = parts
    const key = getKey()
    const iv = Buffer.from(ivB64, 'base64')
    const ct = Buffer.from(ctB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')

    const decipher = createDecipheriv(ALGO_GCM, key, iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ct), decipher.final()])
    return plaintext.toString('utf8')
  }

  // Legacy fallback (migration support): "ivHex:encryptedHex" with AES-256-CBC
  // Requires LEGACY_ENCRYPTION_PASSWORD to be set. No default is used.
  const legacyParts = encryptedText.split(':')
  if (legacyParts.length === 2) {
    const [ivHex, encryptedHex] = legacyParts
    const legacyPassword = process.env.LEGACY_ENCRYPTION_PASSWORD || process.env.ENCRYPTION_PASSWORD
    if (!legacyPassword) {
      throw new Error('LEGACY_ENCRYPTION_PASSWORD (or ENCRYPTION_PASSWORD) is required to decrypt legacy data')
    }

    // Derive 32-byte key using Node scryptSync (deterministic). Use the original fixed salt for backward compatibility only.
    const { scryptSync } = await import('crypto')
    const LEGACY_SALT = 'salt_for_key_derivation'
    const legacyKey = scryptSync(legacyPassword, LEGACY_SALT, 32)

    const iv = Buffer.from(ivHex, 'hex')
    const encrypted = Buffer.from(encryptedHex, 'hex')
    const decipher = createDecipheriv('aes-256-cbc', legacyKey, iv)
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return plaintext.toString('utf8')
  }

  throw new Error('Unrecognized encrypted text format')
}
