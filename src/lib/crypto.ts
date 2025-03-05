import { randomBytes } from 'crypto';

// Constants
const SECURE_SECRET_BYTES = 32;
const BOT_ID_BYTES = 4;

/**
 * Generates a random hex string of specified length
 */
function generateRandomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Generates a random hex string asynchronously
 */
async function generateRandomHexAsync(bytes: number): Promise<string> {
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    randomBytes(bytes, (err, buf) => {
      if (err) reject(err);
      else resolve(buf);
    });
  });
  return buffer.toString('hex');
}

// Function to generate a secure key for encryption
export async function generateEncryptionKey(): Promise<CryptoKey> {
  const key = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
  return key;
}

// Function to encrypt sensitive data
export async function encryptData(data: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(data);
  
  // Generate a random IV (Initialization Vector)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encodedData
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + new Uint8Array(encryptedData).length);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedData), iv.length);
  
  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined));
}

// Function to decrypt sensitive data
export async function decryptData(encryptedData: string, key: CryptoKey): Promise<string> {
  // Convert from base64
  const combined = new Uint8Array(
    atob(encryptedData)
      .split('')
      .map(char => char.charCodeAt(0))
  );
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  
  const decryptedData = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    data
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decryptedData);
}

// Function to generate a secure random bot ID
export function generateBotId(): string {
  return generateRandomHex(BOT_ID_BYTES).toUpperCase();
}

// Function to generate a secure secret
export async function generateSecureSecret(): Promise<string> {
  return generateRandomHexAsync(SECURE_SECRET_BYTES);
}

// Generate a webhook secret synchronously
export function generateSecureSecretSync(): string {
  return generateRandomHex(SECURE_SECRET_BYTES);
}
