import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { prisma } from '@/lib/db';

// Configuration - should match your domain
const RP_NAME = 'Mini Ticker';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

// Challenge expiration time (5 minutes)
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * Format user display name for passkey credential
 * Extracts first segment before '-' and limits to 20 grapheme clusters
 */
function formatUserDisplayName(anonymousId: string): string {
  // Get first segment before '-'
  const firstSegment = anonymousId.split('-')[0];
  
  // Limit to 20 grapheme clusters (visual characters) for safe display
  // Use Intl.Segmenter for proper Unicode handling
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
  const graphemes = [...segmenter.segment(firstSegment)].slice(0, 20);
  const truncated = graphemes.map(g => g.segment).join('');
  
  // Add ellipsis if truncated
  const display = truncated.length < firstSegment.length 
    ? `${truncated}…` 
    : truncated;
  
  return `User: ${display}`;
}

/**
 * Generate WebAuthn registration options for an anonymousId
 */
export async function generateWebAuthnRegistrationOptions(
  anonymousId: string
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  // Get existing credentials for this anonymousId to exclude
  const existingCredentials = await prisma.webAuthnCredential.findMany({
    where: { anonymousId },
    select: { credentialId: true, transports: true },
  });

  const excludeCredentials = existingCredentials.map((cred) => ({
    id: cred.credentialId,
    transports: cred.transports as AuthenticatorTransportFuture[],
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: anonymousId,
    userDisplayName: formatUserDisplayName(anonymousId),
    // Prefer passkeys (resident credentials)
    // Note: Don't restrict authenticatorAttachment to 'platform' - this breaks
    // passkey prompts on some mobile browsers. Omitting it allows the browser
    // to offer both platform (biometric) and cross-platform (synced passkeys) options.
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    // Don't require attestation for simpler UX
    attestationType: 'none',
    excludeCredentials,
  });

  // Store the challenge for verification
  await prisma.authChallenge.create({
    data: {
      anonymousId,
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });

  return options;
}

/**
 * Verify WebAuthn registration response and store credential
 */
export async function verifyWebAuthnRegistration(
  anonymousId: string,
  credential: RegistrationResponseJSON
): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  // Get the stored challenge
  const storedChallenge = await prisma.authChallenge.findFirst({
    where: {
      anonymousId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!storedChallenge) {
    return { success: false, error: 'Challenge expired or not found' };
  }

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (error) {
    console.error('WebAuthn registration verification failed:', error);
    return { success: false, error: 'Verification failed' };
  }

  // Clean up the used challenge
  await prisma.authChallenge.delete({
    where: { id: storedChallenge.id },
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { success: false, error: 'Registration not verified' };
  }

  const { credential: registrationCredential } = verification.registrationInfo;

  // Store the credential linked to anonymousId
  await prisma.webAuthnCredential.create({
    data: {
      anonymousId,
      credentialId: registrationCredential.id,
      publicKey: Buffer.from(registrationCredential.publicKey).toString('base64url'),
      counter: BigInt(registrationCredential.counter),
      transports: (credential.response.transports || []) as string[],
    },
  });

  return { success: true, credentialId: registrationCredential.id };
}

/**
 * Generate WebAuthn authentication options for a specific credential
 */
export async function generateWebAuthnAuthenticationOptions(
  anonymousId: string,
  credentialId?: string
): Promise<PublicKeyCredentialRequestOptionsJSON | null> {
  // Get credentials to allow - either specific one or all for this anonymousId
  const whereClause = credentialId
    ? { credentialId }
    : { anonymousId };

  const storedCredentials = await prisma.webAuthnCredential.findMany({
    where: whereClause,
  });

  if (storedCredentials.length === 0) {
    return null;
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: storedCredentials.map((cred) => ({
      id: cred.credentialId,
      transports: cred.transports as AuthenticatorTransportFuture[],
    })),
    userVerification: 'preferred',
  });

  // Store the challenge for verification
  await prisma.authChallenge.create({
    data: {
      anonymousId,
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });

  return options;
}

/**
 * Verify WebAuthn authentication response
 */
export async function verifyWebAuthnAuthentication(
  anonymousId: string,
  credential: AuthenticationResponseJSON
): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  // Get the stored credential by credentialId (from the response)
  const storedCredential = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: credential.id },
  });

  if (!storedCredential) {
    return { success: false, error: 'No credential found' };
  }

  // Verify the credential belongs to this anonymousId
  if (storedCredential.anonymousId !== anonymousId) {
    return { success: false, error: 'Credential does not belong to this user' };
  }

  // Get the stored challenge
  const storedChallenge = await prisma.authChallenge.findFirst({
    where: {
      anonymousId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!storedChallenge) {
    return { success: false, error: 'Challenge expired or not found' };
  }

  let verification: VerifiedAuthenticationResponse;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: storedCredential.credentialId,
        publicKey: Buffer.from(storedCredential.publicKey, 'base64url'),
        counter: Number(storedCredential.counter),
        transports: storedCredential.transports as AuthenticatorTransportFuture[],
      },
    });
  } catch (error) {
    console.error('WebAuthn authentication verification failed:', error);
    return { success: false, error: 'Verification failed' };
  }

  // Clean up the used challenge
  await prisma.authChallenge.delete({
    where: { id: storedChallenge.id },
  });

  if (!verification.verified) {
    return { success: false, error: 'Authentication not verified' };
  }

  // Update the credential counter and last used time to prevent replay attacks
  await prisma.webAuthnCredential.update({
    where: { credentialId: credential.id },
    data: { 
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  });

  return { success: true, credentialId: credential.id };
}

/**
 * Check if an anonymousId has WebAuthn credentials registered
 */
export async function hasWebAuthnCredential(anonymousId: string): Promise<boolean> {
  const count = await prisma.webAuthnCredential.count({
    where: { anonymousId },
  });
  return count > 0;
}

/**
 * Get credentials for an anonymousId
 */
export async function getWebAuthnCredentials(anonymousId: string) {
  return prisma.webAuthnCredential.findMany({
    where: { anonymousId },
    select: {
      credentialId: true,
      transports: true,
      createdAt: true,
    },
  });
}

/**
 * Check if a specific credentialId exists on the server
 */
export async function verifyCredentialExists(
  anonymousId: string,
  credentialId: string
): Promise<boolean> {
  const credential = await prisma.webAuthnCredential.findFirst({
    where: {
      anonymousId,
      credentialId,
    },
  });
  return !!credential;
}

/**
 * Generate authentication options for discoverable credentials (no allowCredentials)
 */
export async function generateDiscoverableAuthenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    // No allowCredentials - this enables discoverable credential flow
    userVerification: 'required',
  });

  // Store challenge without anonymousId (we don't know it yet)
  // We'll use a temporary ID that we can look up later
  await prisma.authChallenge.create({
    data: {
      anonymousId: 'discoverable', // Placeholder for discoverable flow
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });

  return options;
}

/**
 * Verify discoverable credential authentication and return the associated anonymousId
 */
export async function verifyDiscoverableAuthentication(
  credential: AuthenticationResponseJSON
): Promise<{ success: boolean; anonymousId?: string; credentialId?: string; error?: string }> {
  // Look up the credential by its ID to find the anonymousId
  const storedCredential = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: credential.id },
  });

  if (!storedCredential) {
    return { success: false, error: 'No credential found' };
  }

  // Get the stored challenge (for discoverable flow)
  const storedChallenge = await prisma.authChallenge.findFirst({
    where: {
      anonymousId: 'discoverable',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!storedChallenge) {
    return { success: false, error: 'Challenge expired or not found' };
  }

  let verification: VerifiedAuthenticationResponse;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: storedCredential.credentialId,
        publicKey: Buffer.from(storedCredential.publicKey, 'base64url'),
        counter: Number(storedCredential.counter),
        transports: storedCredential.transports as AuthenticatorTransportFuture[],
      },
    });
  } catch (error) {
    console.error('Discoverable WebAuthn authentication verification failed:', error);
    return { success: false, error: 'Verification failed' };
  }

  // Clean up the used challenge
  await prisma.authChallenge.delete({
    where: { id: storedChallenge.id },
  });

  if (!verification.verified) {
    return { success: false, error: 'Authentication not verified' };
  }

  // Update the credential counter and last used time
  await prisma.webAuthnCredential.update({
    where: { credentialId: credential.id },
    data: { 
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  });

  return { 
    success: true, 
    anonymousId: storedCredential.anonymousId,
    credentialId: credential.id,
  };
}

/**
 * List all passkeys for an anonymousId with metadata
 */
export async function listPasskeys(anonymousId: string) {
  return prisma.webAuthnCredential.findMany({
    where: { anonymousId },
    select: {
      id: true,
      credentialId: true,
      name: true,
      transports: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Rename a passkey
 */
export async function renamePasskey(
  id: string,
  anonymousId: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify ownership
    const credential = await prisma.webAuthnCredential.findUnique({
      where: { id },
    });

    if (!credential) {
      return { success: false, error: 'Passkey not found' };
    }

    if (credential.anonymousId !== anonymousId) {
      return { success: false, error: 'Unauthorized' };
    }

    await prisma.webAuthnCredential.update({
      where: { id },
      data: { name },
    });

    return { success: true };
  } catch (error) {
    console.error('Error renaming passkey:', error);
    return { success: false, error: 'Failed to rename passkey' };
  }
}

/**
 * Delete a passkey
 */
export async function deletePasskey(
  id: string,
  anonymousId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify ownership
    const credential = await prisma.webAuthnCredential.findUnique({
      where: { id },
    });

    if (!credential) {
      return { success: false, error: 'Passkey not found' };
    }

    if (credential.anonymousId !== anonymousId) {
      return { success: false, error: 'Unauthorized' };
    }

    await prisma.webAuthnCredential.delete({
      where: { id },
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting passkey:', error);
    return { success: false, error: 'Failed to delete passkey' };
  }
}
