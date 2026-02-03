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
 * Generate WebAuthn registration options for a check-in session
 */
export async function generateWebAuthnRegistrationOptions(
  checkInId: string,
  anonymousId: string
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  // Check if credential already exists for this check-in
  const existingCredential = await prisma.webAuthnCredential.findUnique({
    where: { checkInId },
  });

  const excludeCredentials = existingCredential
    ? [
        {
          id: existingCredential.credentialId,
          transports: existingCredential.transports as AuthenticatorTransportFuture[],
        },
      ]
    : [];

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
      checkInId,
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
  checkInId: string,
  credential: RegistrationResponseJSON
): Promise<{ success: boolean; error?: string }> {
  // Get the stored challenge
  const storedChallenge = await prisma.authChallenge.findFirst({
    where: {
      checkInId,
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

  // Store the credential
  await prisma.webAuthnCredential.create({
    data: {
      checkInId,
      credentialId: registrationCredential.id,
      publicKey: Buffer.from(registrationCredential.publicKey).toString('base64url'),
      counter: BigInt(registrationCredential.counter),
      transports: (credential.response.transports || []) as string[],
    },
  });

  // Update the check-in to indicate WebAuthn verification method
  await prisma.checkIn.update({
    where: { id: checkInId },
    data: { verificationMethod: 'webauthn' },
  });

  return { success: true };
}

/**
 * Generate WebAuthn authentication options for checkout
 */
export async function generateWebAuthnAuthenticationOptions(
  checkInId: string
): Promise<PublicKeyCredentialRequestOptionsJSON | null> {
  // Get the stored credential for this check-in
  const storedCredential = await prisma.webAuthnCredential.findUnique({
    where: { checkInId },
  });

  if (!storedCredential) {
    return null;
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: [
      {
        id: storedCredential.credentialId,
        transports: storedCredential.transports as AuthenticatorTransportFuture[],
      },
    ],
    userVerification: 'preferred',
  });

  // Store the challenge for verification
  await prisma.authChallenge.create({
    data: {
      checkInId,
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
  checkInId: string,
  credential: AuthenticationResponseJSON
): Promise<{ success: boolean; error?: string }> {
  // Get the stored credential
  const storedCredential = await prisma.webAuthnCredential.findUnique({
    where: { checkInId },
  });

  if (!storedCredential) {
    return { success: false, error: 'No credential found for this check-in' };
  }

  // Get the stored challenge
  const storedChallenge = await prisma.authChallenge.findFirst({
    where: {
      checkInId,
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
    where: { checkInId },
    data: { counter: BigInt(verification.authenticationInfo.newCounter) },
  });

  return { success: true };
}

/**
 * Check if a check-in has WebAuthn credentials registered
 */
export async function hasWebAuthnCredential(checkInId: string): Promise<boolean> {
  const credential = await prisma.webAuthnCredential.findUnique({
    where: { checkInId },
  });
  return !!credential;
}
