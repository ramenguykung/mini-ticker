/**
 * WebAuthn client-side utilities
 * Uses the Web Authentication API for browser-based credential management
 */

/**
 * Check if WebAuthn is supported in this browser
 */
export function isWebAuthnSupported(): boolean {
  return !!(
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === 'function'
  );
}

/**
 * Check if the platform supports passkeys (platform authenticator)
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    return false;
  }
  
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Start the WebAuthn registration ceremony
 */
export async function startRegistration(
  checkInId: string,
  anonymousId: string
): Promise<{ success: boolean; error?: string; cancelled?: boolean }> {
  try {
    // Get registration options from server
    const optionsResponse = await fetch('/api/auth/webauthn/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkInId, anonymousId }),
    });

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      return { success: false, error: error.error || 'Failed to get registration options' };
    }

    const options = await optionsResponse.json();

    // Convert base64url strings to ArrayBuffers for the browser API
    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      ...options,
      challenge: base64urlToBuffer(options.challenge),
      user: {
        ...options.user,
        id: base64urlToBuffer(options.user.id),
      },
      excludeCredentials: options.excludeCredentials?.map((cred: { id: string; type: string; transports?: string[] }) => ({
        ...cred,
        id: base64urlToBuffer(cred.id),
      })),
    };

    // Create credential using the browser's authenticator
    const credential = await navigator.credentials.create({
      publicKey: publicKeyOptions,
    }) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: 'No credential returned', cancelled: true };
    }

    // Convert the credential to JSON format for sending to server
    const attestationResponse = credential.response as AuthenticatorAttestationResponse;
    const credentialJSON = {
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      response: {
        clientDataJSON: bufferToBase64url(attestationResponse.clientDataJSON),
        attestationObject: bufferToBase64url(attestationResponse.attestationObject),
        transports: attestationResponse.getTransports?.() || [],
      },
      type: credential.type,
      clientExtensionResults: credential.getClientExtensionResults(),
      authenticatorAttachment: (credential as PublicKeyCredential & { authenticatorAttachment?: string }).authenticatorAttachment,
    };

    // Verify the credential with the server
    const verifyResponse = await fetch('/api/auth/webauthn/register/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkInId, credential: credentialJSON }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      return { success: false, error: error.error || 'Failed to verify registration' };
    }

    return { success: true };
  } catch (error) {
    // Handle user cancellation
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        return { success: false, error: 'User cancelled or denied the request', cancelled: true };
      }
      if (error.name === 'AbortError') {
        return { success: false, error: 'Request was aborted', cancelled: true };
      }
    }
    
    console.error('WebAuthn registration error:', error);
    return { success: false, error: 'Registration failed' };
  }
}

/**
 * Start the WebAuthn authentication ceremony
 */
export async function startAuthentication(
  checkInId: string
): Promise<{ success: boolean; error?: string; cancelled?: boolean }> {
  try {
    // Get authentication options from server
    const optionsResponse = await fetch('/api/auth/webauthn/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkInId }),
    });

    if (!optionsResponse.ok) {
      if (optionsResponse.status === 404) {
        return { success: false, error: 'No WebAuthn credential found' };
      }
      const error = await optionsResponse.json();
      return { success: false, error: error.error || 'Failed to get authentication options' };
    }

    const options = await optionsResponse.json();

    // Convert base64url strings to ArrayBuffers for the browser API
    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      ...options,
      challenge: base64urlToBuffer(options.challenge),
      allowCredentials: options.allowCredentials?.map((cred: { id: string; type: string; transports?: string[] }) => ({
        ...cred,
        id: base64urlToBuffer(cred.id),
      })),
    };

    // Get credential using the browser's authenticator
    const credential = await navigator.credentials.get({
      publicKey: publicKeyOptions,
    }) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: 'No credential returned', cancelled: true };
    }

    // Convert the credential to JSON format for sending to server
    const assertionResponse = credential.response as AuthenticatorAssertionResponse;
    const credentialJSON = {
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      response: {
        clientDataJSON: bufferToBase64url(assertionResponse.clientDataJSON),
        authenticatorData: bufferToBase64url(assertionResponse.authenticatorData),
        signature: bufferToBase64url(assertionResponse.signature),
        userHandle: assertionResponse.userHandle 
          ? bufferToBase64url(assertionResponse.userHandle) 
          : undefined,
      },
      type: credential.type,
      clientExtensionResults: credential.getClientExtensionResults(),
      authenticatorAttachment: (credential as PublicKeyCredential & { authenticatorAttachment?: string }).authenticatorAttachment,
    };

    // Verify the credential with the server
    const verifyResponse = await fetch('/api/auth/webauthn/authenticate/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkInId, credential: credentialJSON }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      return { success: false, error: error.error || 'Failed to verify authentication' };
    }

    return { success: true };
  } catch (error) {
    // Handle user cancellation
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        return { success: false, error: 'User cancelled or denied the request', cancelled: true };
      }
      if (error.name === 'AbortError') {
        return { success: false, error: 'Request was aborted', cancelled: true };
      }
    }
    
    console.error('WebAuthn authentication error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

// Helper functions for base64url conversion

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
