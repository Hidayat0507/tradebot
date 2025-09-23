import { describe, it, expect } from 'bun:test'
import { randomBytes, createCipheriv, scryptSync } from 'crypto'

// Import the module under test using a relative path to avoid TS path alias issues in test runner
import { encrypt, decrypt } from '../src/utils/encryption'

async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T> | T): Promise<T> {
  const prev: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k]
    if (typeof v === 'undefined') {
      delete process.env[k]
    } else {
      process.env[k] = v
    }
  }
  try {
    const result = fn()
    if (result && typeof (result as any).then === 'function') {
      return await (result as any)
    }
    return result as T
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (typeof v === 'undefined') delete process.env[k]
      else process.env[k] = v
    }
  }
}

describe('encryption: AES-256-GCM (v1)', () => {
  it('roundtrips with base64 key', async () => {
    const key = randomBytes(32)
    await withEnv({ ENCRYPTION_KEY: key.toString('base64') }, async () => {
      const plaintext = 'hello secure world'
      const enc = await encrypt(plaintext)
      expect(enc.startsWith('v1:')).toBe(true)
      const dec = await decrypt(enc)
      expect(dec).toBe(plaintext)
    })
  })

  it('roundtrips with hex key', async () => {
    const key = randomBytes(32)
    await withEnv({ ENCRYPTION_KEY: key.toString('hex') }, async () => {
      const plaintext = 'hex key test'
      const enc = await encrypt(plaintext)
      expect(enc.split(':').length).toBe(4)
      const dec = await decrypt(enc)
      expect(dec).toBe(plaintext)
    })
  })

  it('throws on bad ENCRYPTION_KEY length', async () => {
    await expect(
      withEnv({ ENCRYPTION_KEY: randomBytes(16).toString('base64') }, async () => {
        await encrypt('test')
      })
    ).rejects.toBeInstanceOf(Error)
  })

  it('fails on malformed v1 format', async () => {
    const key = randomBytes(32)
    await withEnv({ ENCRYPTION_KEY: key.toString('base64') }, async () => {
      await expect(decrypt('v1:only_iv')).rejects.toBeInstanceOf(Error)
    })
  })
})

describe('legacy decrypt compatibility (AES-256-CBC ivHex:cipherHex)', () => {
  function encryptLegacy(plaintext: string, password: string): string {
    const LEGACY_SALT = 'salt_for_key_derivation'
    const key = scryptSync(password, LEGACY_SALT, 32)
    const iv = randomBytes(16)
    const cipher = createCipheriv('aes-256-cbc', key, iv)
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return `${iv.toString('hex')}:${enc.toString('hex')}`
  }

  it('decrypts legacy payload with LEGACY_ENCRYPTION_PASSWORD', async () => {
    const legacyPassword = 'legacy-secret'
    const legacy = encryptLegacy('legacy message', legacyPassword)
    const key = randomBytes(32) // current key is irrelevant for legacy path
    await withEnv({ ENCRYPTION_KEY: key.toString('base64'), LEGACY_ENCRYPTION_PASSWORD: legacyPassword }, async () => {
      const dec = await decrypt(legacy)
      expect(dec).toBe('legacy message')
    })
  })

  it('throws for legacy payload without legacy password', async () => {
    const legacy = encryptLegacy('needs pw', 'pw')
    const key = randomBytes(32)
    await withEnv({ ENCRYPTION_KEY: key.toString('base64'), LEGACY_ENCRYPTION_PASSWORD: undefined }, async () => {
      await expect(decrypt(legacy)).rejects.toBeInstanceOf(Error)
    })
  })
})


