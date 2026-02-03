/**
 * Software crypto key management for browsers
 * Uses the Web Crypto API for ECDSA P-256 key generation and signing
 * 
 * Keys are stored by anonymousId for reuse across check-in sessions
 */

const STORAGE_KEY_PREFIX = 'mini-ticker-crypto-key-';
const FINGERPRINT_PREFIX = 'mini-ticker-key-fingerprint-';

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
 * Store private key in localStorage for a specific anonymousId
 */
export async function storePrivateKey(anonymousId: string, privateKey: CryptoKey, keyFingerprint: string): Promise<void> {
  const jwk = await exportPrivateKey(privateKey);
  localStorage.setItem(STORAGE_KEY_PREFIX + anonymousId, JSON.stringify(jwk));
  localStorage.setItem(FINGERPRINT_PREFIX + anonymousId, keyFingerprint);
}

/**
 * Get private key from localStorage for a specific anonymousId
 */
export async function getPrivateKey(anonymousId: string): Promise<CryptoKey | null> {
  const jwkString = localStorage.getItem(STORAGE_KEY_PREFIX + anonymousId);
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
 * Get the stored key fingerprint for an anonymousId
 */
export function getKeyFingerprint(anonymousId: string): string | null {
  return localStorage.getItem(FINGERPRINT_PREFIX + anonymousId);
}

/**
 * Check if a private key exists for an anonymousId
 */
export function hasPrivateKey(anonymousId: string): boolean {
  return localStorage.getItem(STORAGE_KEY_PREFIX + anonymousId) !== null;
}

/**
 * Remove private key and fingerprint from localStorage
 */
export function removePrivateKey(anonymousId: string): void {
  localStorage.removeItem(STORAGE_KEY_PREFIX + anonymousId);
  localStorage.removeItem(FINGERPRINT_PREFIX + anonymousId);
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
  
  return bufferToBase64url(signature);
}

/**
 * Register a software key for an anonymousId
 */
export async function registerSoftwareKey(
  anonymousId: string
): Promise<{ success: boolean; keyFingerprint?: string; error?: string }> {
  try {
    // Generate a new key pair
    const keyPair = await generateKeyPair();
    
    // Export the public key
    const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
    
    // Extract only the necessary public key fields
    const publicKey = {
      kty: publicKeyJwk.kty,
      crv: publicKeyJwk.crv,
      x: publicKeyJwk.x,
      y: publicKeyJwk.y,
    };
    
    // Send public key to server
    const response = await fetch('/api/auth/software/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId, publicKey }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to register software key' };
    }
    
    const { keyFingerprint } = await response.json();
    
    // Store private key and fingerprint locally
    await storePrivateKey(anonymousId, keyPair.privateKey, keyFingerprint);
    
    return { success: true, keyFingerprint };
  } catch (error) {
    console.error('Error registering software key:', error);
    return { success: false, error: 'Failed to generate or store software key' };
  }
}

/**
 * Verify identity using software key
 */
export async function verifySoftwareKey(
  anonymousId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the private key
    const privateKey = await getPrivateKey(anonymousId);
    if (!privateKey) {
      return { success: false, error: 'No software key found for this user' };
    }
    
    // Get the stored fingerprint
    const keyFingerprint = getKeyFingerprint(anonymousId);
    if (!keyFingerprint) {
      return { success: false, error: 'No key fingerprint found' };
    }
    
    // Get a challenge from the server
    const challengeResponse = await fetch('/api/auth/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId }),
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
      body: JSON.stringify({ anonymousId, keyFingerprint, challenge, signature }),
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

/**
 * Check if stored credential is valid on server
 */
export async function verifyStoredKeyExists(
  anonymousId: string
): Promise<{ valid: boolean; keyFingerprint?: string }> {
  const keyFingerprint = getKeyFingerprint(anonymousId);
  if (!keyFingerprint) {
    return { valid: false };
  }

  try {
    const response = await fetch('/api/auth/credentials/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId, keyFingerprint }),
    });

    if (!response.ok) {
      return { valid: false };
    }

    const data = await response.json();
    return { valid: data.credentialValid, keyFingerprint };
  } catch {
    return { valid: false };
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
