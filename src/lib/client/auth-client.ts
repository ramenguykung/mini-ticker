/**
 * Unified authentication client
 * Orchestrates WebAuthn and software crypto key authentication with credential reuse
 */

import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  startRegistration as webauthnRegister,
  startAuthentication as webauthnAuth,
  hasStoredCredentialId,
  getStoredCredentialId,
  removeStoredCredentialId,
  verifyStoredCredentialExists,
} from './webauthn-client';

import {
  registerSoftwareKey,
  verifySoftwareKey,
  hasPrivateKey,
  removePrivateKey,
  getKeyFingerprint,
  verifyStoredKeyExists,
} from './crypto-client';

export type AuthMethod = 'webauthn' | 'software' | null;

// Storage keys for user profile
const USER_PROFILE_KEY = 'mini-ticker-user-profile';

interface UserProfile {
  anonymousId: string;
  authMethod: AuthMethod;
  credentialId?: string;
  keyFingerprint?: string;
}

export interface RegistrationResult {
  success: boolean;
  method?: AuthMethod;
  credentialId?: string;
  keyFingerprint?: string;
  error?: string;
  showChoiceDialog?: boolean;
}

export interface VerificationResult {
  success: boolean;
  method?: AuthMethod;
  error?: string;
}

export interface StoredCredentialInfo {
  hasCredential: boolean;
  method: AuthMethod;
  isValid: boolean;
  credentialId?: string;
  keyFingerprint?: string;
}

/**
 * Store user profile in localStorage
 */
export function storeUserProfile(profile: UserProfile): void {
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
}

/**
 * Get user profile from localStorage
 */
export function getUserProfile(): UserProfile | null {
  const profileString = localStorage.getItem(USER_PROFILE_KEY);
  if (!profileString) return null;
  try {
    return JSON.parse(profileString) as UserProfile;
  } catch {
    return null;
  }
}

/**
 * Remove user profile
 */
export function removeUserProfile(): void {
  localStorage.removeItem(USER_PROFILE_KEY);
}

/**
 * Check if user has stored credentials for an anonymousId
 */
export async function checkStoredCredentials(anonymousId: string): Promise<StoredCredentialInfo> {
  // Check for WebAuthn credential
  if (hasStoredCredentialId(anonymousId)) {
    const { valid, credentialId } = await verifyStoredCredentialExists(anonymousId);
    if (valid) {
      return {
        hasCredential: true,
        method: 'webauthn',
        isValid: true,
        credentialId,
      };
    }
    // Orphaned local credential - server doesn't have it
    return {
      hasCredential: true,
      method: 'webauthn',
      isValid: false,
      credentialId,
    };
  }

  // Check for software key
  if (hasPrivateKey(anonymousId)) {
    const { valid, keyFingerprint } = await verifyStoredKeyExists(anonymousId);
    if (valid) {
      return {
        hasCredential: true,
        method: 'software',
        isValid: true,
        keyFingerprint,
      };
    }
    // Orphaned local key
    return {
      hasCredential: true,
      method: 'software',
      isValid: false,
      keyFingerprint,
    };
  }

  return {
    hasCredential: false,
    method: null,
    isValid: false,
  };
}

/**
 * Register new credentials or use existing ones
 * 
 * @param anonymousId - The user's anonymous ID
 * @param forceMethod - Force a specific method (skip preference detection)
 * @param forceNew - Force creating new credentials even if existing ones are valid
 */
export async function registerCredentials(
  anonymousId: string,
  forceMethod?: AuthMethod,
  forceNew: boolean = false
): Promise<RegistrationResult> {
  // If not forcing new, check for existing valid credentials
  if (!forceNew) {
    const existing = await checkStoredCredentials(anonymousId);
    if (existing.hasCredential && existing.isValid) {
      // Update user profile with existing credentials
      storeUserProfile({
        anonymousId,
        authMethod: existing.method,
        credentialId: existing.credentialId,
        keyFingerprint: existing.keyFingerprint,
      });
      return {
        success: true,
        method: existing.method,
        credentialId: existing.credentialId,
        keyFingerprint: existing.keyFingerprint,
      };
    }
  }

  // Determine which method to use
  if (forceMethod === 'software') {
    return await registerWithSoftwareKey(anonymousId);
  }

  // Try WebAuthn first if supported
  // Note: We try WebAuthn even if isPlatformAuthenticatorAvailable returns false,
  // because on mobile browsers this check can be unreliable and passkeys may still work
  const webauthnSupported = isWebAuthnSupported();

  if (webauthnSupported) {
    const result = await webauthnRegister(anonymousId);

    if (result.success) {
      storeUserProfile({
        anonymousId,
        authMethod: 'webauthn',
        credentialId: result.credentialId,
      });
      return {
        success: true,
        method: 'webauthn',
        credentialId: result.credentialId,
      };
    }

    // If user cancelled, show choice dialog
    if (result.cancelled) {
      return {
        success: false,
        showChoiceDialog: true,
        error: 'WebAuthn registration was cancelled',
      };
    }

    // WebAuthn failed for other reason, try software key
    return await registerWithSoftwareKey(anonymousId);
  }

  // Fall back to software key (WebAuthn not supported)
  return await registerWithSoftwareKey(anonymousId);
}

/**
 * Register with software key
 */
async function registerWithSoftwareKey(anonymousId: string): Promise<RegistrationResult> {
  const result = await registerSoftwareKey(anonymousId);
  
  if (result.success) {
    storeUserProfile({
      anonymousId,
      authMethod: 'software',
      keyFingerprint: result.keyFingerprint,
    });
    return {
      success: true,
      method: 'software',
      keyFingerprint: result.keyFingerprint,
    };
  }

  return {
    success: false,
    error: result.error || 'Failed to register software key',
  };
}

/**
 * Verify credentials for checkout
 */
export async function verifyForCheckout(anonymousId: string): Promise<VerificationResult> {
  // Check what credentials we have
  const stored = await checkStoredCredentials(anonymousId);

  if (!stored.hasCredential) {
    // No credentials - legacy check-in, allow checkout
    return { success: true, method: null };
  }

  if (!stored.isValid) {
    // Orphaned credentials - allow checkout but warn
    console.warn('Credentials orphaned - allowing checkout without verification');
    return { success: true, method: null };
  }

  // Try to verify with the stored method
  if (stored.method === 'webauthn') {
    const result = await webauthnAuth(anonymousId, stored.credentialId);

    if (result.success) {
      return { success: true, method: 'webauthn' };
    }

    // If WebAuthn failed, try software key as fallback
    if (hasPrivateKey(anonymousId)) {
      const softwareResult = await verifySoftwareKey(anonymousId);
      if (softwareResult.success) {
        return { success: true, method: 'software' };
      }
    }

    return {
      success: false,
      method: 'webauthn',
      error: result.error,
    };
  }

  if (stored.method === 'software') {
    const result = await verifySoftwareKey(anonymousId);
    return {
      success: result.success,
      method: 'software',
      error: result.error,
    };
  }

  return { success: true, method: null };
}

/**
 * Get the auth method label for display
 */
export function getAuthMethodLabel(method: AuthMethod): string {
  switch (method) {
    case 'webauthn':
      return 'Passkey (Biometric/Security Key)';
    case 'software':
      return 'Software Security Key';
    default:
      return 'None';
  }
}

/**
 * Purge all stored credentials for fresh start
 */
export function purgeAllCredentials(): void {
  // Remove user profile
  removeUserProfile();

  // Find and remove all mini-ticker related items
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('mini-ticker-')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Cleanup auth data for a specific anonymousId (for logout without purging profile)
 */
export function cleanupAuthData(anonymousId: string): void {
  removeStoredCredentialId(anonymousId);
  removePrivateKey(anonymousId);
}

/**
 * Re-export useful functions
 */
export {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  hasStoredCredentialId,
  getStoredCredentialId,
  hasPrivateKey,
  getKeyFingerprint,
};
