/**
 * Software crypto key management for browsers
 * Uses the Web Crypto API for ECDSA P-256 key generation and signing
 */

const STORAGE_KEY_PREFIX = 'mini-ticker-crypto-key-';

/**
 * Generate a new ECDSA P-256 key pair
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true, // extractable - we need to export the public key
    ['sign', 'verify']
  );
}

/**
 * Export public key as JWK format
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey('jwk', publicKey);
}

/**
 * Export private key as JWK format
 */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey('jwk', privateKey);
}

/**
 * Import private key from JWK format
 */
export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false, // not extractable after import
    ['sign']
  );
}

/**
 * Store private key in localStorage for a specific check-in
 */
export async function storePrivateKey(checkInId: string, privateKey: CryptoKey): Promise<void> {
  const jwk = await exportPrivateKey(privateKey);
  localStorage.setItem(STORAGE_KEY_PREFIX + checkInId, JSON.stringify(jwk));
}

/**
 * Get private key from localStorage for a specific check-in
 */
export async function getPrivateKey(checkInId: string): Promise<CryptoKey | null> {
  const jwkString = localStorage.getItem(STORAGE_KEY_PREFIX + checkInId);
  if (!jwkString) {
    return null;
  }
  
  try {
    const jwk = JSON.parse(jwkString) as JsonWebKey;
    return await importPrivateKey(jwk);
  } catch (error) {
    console.error('Error loading private key:', error);
    return null;
  }
}

/**
 * Check if a private key exists for a check-in
 */
export function hasPrivateKey(checkInId: string): boolean {
  return localStorage.getItem(STORAGE_KEY_PREFIX + checkInId) !== null;
}

/**
 * Remove private key from localStorage
 */
export function removePrivateKey(checkInId: string): void {
  localStorage.removeItem(STORAGE_KEY_PREFIX + checkInId);
}

/**
 * Sign a challenge with the private key
 */
export async function signChallenge(
  privateKey: CryptoKey,
  challenge: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(challenge);
  
  const signature = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    privateKey,
    data
  );
  
  // Convert to base64url
  return bufferToBase64url(signature);
}

/**
 * Register a software key for a check-in
 */
export async function registerSoftwareKey(
  checkInId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate a new key pair
    const keyPair = await generateKeyPair();
    
    // Export the public key
    const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
    
    // Send public key to server
    const response = await fetch('/api/auth/software/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkInId, publicKeyJwk }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to register software key' };
    }
    
    // Store private key locally
    await storePrivateKey(checkInId, keyPair.privateKey);
    
    return { success: true };
  } catch (error) {
    console.error('Error registering software key:', error);
    return { success: false, error: 'Failed to generate or store software key' };
  }
}

/**
 * Verify identity using software key
 */
export async function verifySoftwareKey(
  checkInId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the private key
    const privateKey = await getPrivateKey(checkInId);
    if (!privateKey) {
      return { success: false, error: 'No software key found for this check-in' };
    }
    
    // Get a challenge from the server
    const challengeResponse = await fetch('/api/auth/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkInId }),
    });
    
    if (!challengeResponse.ok) {
      const error = await challengeResponse.json();
      return { success: false, error: error.error || 'Failed to get challenge' };
    }
    
    const { challenge } = await challengeResponse.json();
    
    // Sign the challenge
    const signature = await signChallenge(privateKey, challenge);
    
    // Verify with server
    const verifyResponse = await fetch('/api/auth/software/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkInId, challenge, signature }),
    });
    
    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      return { success: false, error: error.error || 'Verification failed' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error verifying software key:', error);
    return { success: false, error: 'Software key verification failed' };
  }
}

// Helper function for base64url conversion
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
