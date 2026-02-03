/**
 * Unified authentication orchestrator
 * Handles the WebAuthn-first-then-software-fallback flow
 */

import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  startRegistration,
  startAuthentication,
} from './webauthn-client';

import {
  registerSoftwareKey,
  verifySoftwareKey,
  hasPrivateKey,
  removePrivateKey,
} from './crypto-client';

export type AuthMethod = 'webauthn' | 'software' | null;
export type RegistrationResult = {
  success: boolean;
  method?: AuthMethod;
  error?: string;
  showChoiceDialog?: boolean;
};

export type VerificationResult = {
  success: boolean;
  method?: AuthMethod;
  error?: string;
};

const AUTH_METHOD_KEY_PREFIX = 'mini-ticker-auth-method-';

/**
 * Store the authentication method used for a check-in
 */
export function storeAuthMethod(checkInId: string, method: AuthMethod): void {
  if (method) {
    localStorage.setItem(AUTH_METHOD_KEY_PREFIX + checkInId, method);
  }
}

/**
 * Get the authentication method used for a check-in
 */
export function getAuthMethod(checkInId: string): AuthMethod {
  const method = localStorage.getItem(AUTH_METHOD_KEY_PREFIX + checkInId);
  return (method as AuthMethod) || null;
}

/**
 * Remove stored authentication method
 */
export function removeAuthMethod(checkInId: string): void {
  localStorage.removeItem(AUTH_METHOD_KEY_PREFIX + checkInId);
}

/**
 * Check if WebAuthn is available and should be offered
 */
export async function shouldOfferWebAuthn(): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    return false;
  }
  
  // Check if platform authenticator is available (Touch ID, Face ID, Windows Hello, etc.)
  const hasPlatformAuth = await isPlatformAuthenticatorAvailable();
  return hasPlatformAuth;
}

/**
 * Register credentials for a check-in session
 * Tries WebAuthn first, then falls back to software key on failure
 * Returns showChoiceDialog: true if user cancelled and should be given a choice
 */
export async function registerCredentials(
  checkInId: string,
  anonymousId: string,
  forceMethod?: AuthMethod
): Promise<RegistrationResult> {
  // If a specific method is forced, use it
  if (forceMethod === 'software') {
    const result = await registerSoftwareKey(checkInId);
    if (result.success) {
      storeAuthMethod(checkInId, 'software');
      return { success: true, method: 'software' };
    }
    return { success: false, error: result.error };
  }

  // Check if WebAuthn should be offered
  const offerWebAuthn = await shouldOfferWebAuthn();
  
  if (!offerWebAuthn) {
    // WebAuthn not available, use software key directly
    const result = await registerSoftwareKey(checkInId);
    if (result.success) {
      storeAuthMethod(checkInId, 'software');
      return { success: true, method: 'software' };
    }
    return { success: false, error: result.error };
  }

  // Try WebAuthn first
  const webauthnResult = await startRegistration(checkInId, anonymousId);
  
  if (webauthnResult.success) {
    storeAuthMethod(checkInId, 'webauthn');
    return { success: true, method: 'webauthn' };
  }

  // If user cancelled, show choice dialog instead of auto-falling back
  if (webauthnResult.cancelled) {
    return { 
      success: false, 
      showChoiceDialog: true,
      error: 'WebAuthn registration was cancelled'
    };
  }

  // For other errors, also show choice dialog
  return { 
    success: false, 
    showChoiceDialog: true,
    error: webauthnResult.error 
  };
}

/**
 * Verify identity for checkout
 * Tries WebAuthn first if that was the registration method,
 * falls back to software key if WebAuthn fails
 */
export async function verifyForCheckout(
  checkInId: string
): Promise<VerificationResult> {
  const authMethod = getAuthMethod(checkInId);
  
  // Legacy check-ins without credentials
  if (!authMethod) {
    // Check if there's a software key stored (might be from before method tracking)
    if (hasPrivateKey(checkInId)) {
      const result = await verifySoftwareKey(checkInId);
      return { 
        success: result.success, 
        method: 'software',
        error: result.error 
      };
    }
    // No credentials - this is a legacy check-in, allow checkout
    return { success: true, method: null };
  }

  // Try WebAuthn if that's the registered method
  if (authMethod === 'webauthn') {
    const webauthnResult = await startAuthentication(checkInId);
    
    if (webauthnResult.success) {
      return { success: true, method: 'webauthn' };
    }

    // If WebAuthn failed (including user cancel), try software key as fallback
    if (hasPrivateKey(checkInId)) {
      const softwareResult = await verifySoftwareKey(checkInId);
      if (softwareResult.success) {
        return { success: true, method: 'software' };
      }
    }

    return { 
      success: false, 
      method: 'webauthn',
      error: webauthnResult.error 
    };
  }

  // Software key verification
  if (authMethod === 'software') {
    const result = await verifySoftwareKey(checkInId);
    return { 
      success: result.success, 
      method: 'software',
      error: result.error 
    };
  }

  return { success: false, error: 'Unknown authentication method' };
}

/**
 * Clean up all authentication data for a check-in
 */
export function cleanupAuthData(checkInId: string): void {
  removeAuthMethod(checkInId);
  removePrivateKey(checkInId);
}

/**
 * Get a human-readable description of the auth method
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
