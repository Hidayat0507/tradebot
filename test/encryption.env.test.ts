import { describe, it, expect } from 'bun:test'
import dotenv from 'dotenv'
import { encrypt, decrypt } from '../src/utils/encryption'

describe('encryption uses ENCRYPTION_KEY from .env.local', () => {
  it('roundtrips using actual env key', async () => {
    dotenv.config({ path: '.env.local' })
    expect(process.env.ENCRYPTION_KEY, 'ENCRYPTION_KEY must be set in .env.local').toBeTruthy()
    const text = 'smoke-test'
    const enc = await encrypt(text)
    const dec = await decrypt(enc)
    expect(dec).toBe(text)
  })
})



