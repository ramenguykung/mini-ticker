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
    userDisplayName: `User ${anonymousId.substring(0, 8)}`,
    // Prefer passkeys (resident credentials)
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

  // Update the credential counter to prevent replay attacks
  await prisma.webAuthnCredential.update({
    where: { credentialId: credential.id },
    data: { counter: BigInt(verification.authenticationInfo.newCounter) },
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
