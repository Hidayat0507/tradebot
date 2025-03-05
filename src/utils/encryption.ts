import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Use a fixed salt for development - in production, this should be an environment variable
const SALT = 'salt_for_key_derivation';

// Derive a 32-byte key from a password
const deriveKey = (password: string): Buffer => {
  // Use a fixed password if none is provided in environment
  const envPassword = process.env.ENCRYPTION_PASSWORD || 'default_encryption_password';
  const actualPassword = password || envPassword;
  
  // Use scrypt to derive a 32-byte key
  return scryptSync(actualPassword, SALT, 32);
};

const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypts a string using AES-256-CBC
 * @param text The text to encrypt
 * @returns The encrypted text as a hex string with IV prepended
 */
export async function encrypt(text: string): Promise<string> {
  if (!text) return '';
  
  try {
    // Generate a random 16-byte IV
    const iv = randomBytes(16);
    
    // Derive a 32-byte key
    const key = deriveKey('');
    
    // Create cipher and encrypt
    const cipher = createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error(`Failed to encrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypts a string that was encrypted with the encrypt function
 * @param encryptedText The encrypted text (IV:encryptedData format)
 * @returns The decrypted string
 */
export async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText) return '';
  
  try {
    // Split the IV and encrypted data
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted text format');
    }
    
    // Convert IV from hex to Buffer
    const iv = Buffer.from(ivHex, 'hex');
    
    // Derive the same 32-byte key
    const key = deriveKey('');
    
    // Create decipher and decrypt
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error(`Failed to decrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
