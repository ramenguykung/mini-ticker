import { prisma } from '@/lib/db';
import crypto from 'crypto';

// Challenge expiration time (5 minutes)
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * Generate a cryptographically secure challenge
 */
export function generateChallenge(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Store a challenge for software key verification
 */
export async function storeChallenge(checkInId: string): Promise<string> {
  const challenge = generateChallenge();
  
  await prisma.authChallenge.create({
    data: {
      checkInId,
      challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });
  
  return challenge;
}

/**
 * Get and validate a stored challenge
 */
export async function getValidChallenge(checkInId: string, challenge: string): Promise<boolean> {
  const storedChallenge = await prisma.authChallenge.findFirst({
    where: {
      checkInId,
      challenge,
      expiresAt: { gt: new Date() },
    },
  });

  if (!storedChallenge) {
    return false;
  }

  // Delete the challenge after use (one-time use)
  await prisma.authChallenge.delete({
    where: { id: storedChallenge.id },
  });

  return true;
}

/**
 * Store a software public key for a check-in
 */
export async function storeSoftwareKey(
  checkInId: string,
  publicKeyJwk: JsonWebKey
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if key already exists
    const existing = await prisma.softwareKey.findUnique({
      where: { checkInId },
    });

    if (existing) {
      return { success: false, error: 'Software key already registered for this check-in' };
    }

    await prisma.softwareKey.create({
      data: {
        checkInId,
        publicKeyJwk: JSON.stringify(publicKeyJwk),
      },
    });

    // Update the check-in to indicate software verification method
    await prisma.checkIn.update({
      where: { id: checkInId },
      data: { verificationMethod: 'software' },
    });

    return { success: true };
  } catch (error) {
    console.error('Error storing software key:', error);
    return { success: false, error: 'Failed to store software key' };
  }
}

/**
 * Verify a signature using the stored software public key
 * Uses Web Crypto API compatible ECDSA P-256 verification
 */
export async function verifySoftwareSignature(
  checkInId: string,
  challenge: string,
  signatureBase64: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the stored public key
    const softwareKey = await prisma.softwareKey.findUnique({
      where: { checkInId },
    });

    if (!softwareKey) {
      return { success: false, error: 'No software key found for this check-in' };
    }

    // Validate the challenge
    const isValidChallenge = await getValidChallenge(checkInId, challenge);
    if (!isValidChallenge) {
      return { success: false, error: 'Invalid or expired challenge' };
    }

    // Parse the stored JWK
    const publicKeyJwk = JSON.parse(softwareKey.publicKeyJwk) as JsonWebKey;

    // Import the public key using Node.js crypto
    const publicKey = crypto.createPublicKey({
      key: {
        kty: publicKeyJwk.kty,
        crv: publicKeyJwk.crv,
        x: publicKeyJwk.x,
        y: publicKeyJwk.y,
      },
      format: 'jwk',
    });

    // Decode the signature from base64url
    const signature = Buffer.from(signatureBase64, 'base64url');

    // The challenge was signed directly, so we verify against it
    const challengeBuffer = Buffer.from(challenge, 'utf-8');

    // Verify the ECDSA signature
    // Web Crypto uses IEEE P1363 format, Node uses DER
    // We need to convert the signature from IEEE P1363 to DER format
    const derSignature = convertP1363ToDER(signature);

    const isValid = crypto.verify(
      'sha256',
      challengeBuffer,
      {
        key: publicKey,
        dsaEncoding: 'der',
      },
      derSignature
    );

    if (!isValid) {
      return { success: false, error: 'Invalid signature' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error verifying software signature:', error);
    return { success: false, error: 'Signature verification failed' };
  }
}

/**
 * Convert IEEE P1363 signature format (used by Web Crypto) to DER format (used by Node.js)
 * P1363 format: r || s (each 32 bytes for P-256)
 * DER format: SEQUENCE { INTEGER r, INTEGER s }
 */
function convertP1363ToDER(signature: Buffer): Buffer {
  const r = signature.subarray(0, 32);
  const s = signature.subarray(32, 64);

  // Remove leading zeros but ensure high bit handling
  const rPadded = addLeadingZeroIfNeeded(trimLeadingZeros(r));
  const sPadded = addLeadingZeroIfNeeded(trimLeadingZeros(s));

  // Build DER structure
  const rLen = rPadded.length;
  const sLen = sPadded.length;
  const totalLen = 2 + rLen + 2 + sLen; // 2 bytes for each INTEGER header

  const der = Buffer.alloc(2 + totalLen);
  let offset = 0;

  // SEQUENCE header
  der[offset++] = 0x30; // SEQUENCE tag
  der[offset++] = totalLen;

  // INTEGER r
  der[offset++] = 0x02; // INTEGER tag
  der[offset++] = rLen;
  rPadded.copy(der, offset);
  offset += rLen;

  // INTEGER s
  der[offset++] = 0x02; // INTEGER tag
  der[offset++] = sLen;
  sPadded.copy(der, offset);

  return der;
}

/**
 * Trim leading zero bytes from a buffer
 */
function trimLeadingZeros(buf: Buffer): Buffer {
  let i = 0;
  while (i < buf.length - 1 && buf[i] === 0) {
    i++;
  }
  return buf.subarray(i);
}

/**
 * Add a leading zero byte if the high bit is set (to ensure positive integer in DER)
 */
function addLeadingZeroIfNeeded(buf: Buffer): Buffer {
  if (buf[0] & 0x80) {
    return Buffer.concat([Buffer.from([0x00]), buf]);
  }
  return buf;
}

/**
 * Check if a check-in has a software key registered
 */
export async function hasSoftwareKey(checkInId: string): Promise<boolean> {
  const key = await prisma.softwareKey.findUnique({
    where: { checkInId },
  });
  return !!key;
}

/**
 * Get the verification method for a check-in
 */
export async function getVerificationMethod(checkInId: string): Promise<string | null> {
  const checkIn = await prisma.checkIn.findUnique({
    where: { id: checkInId },
    select: { verificationMethod: true },
  });
  return checkIn?.verificationMethod || null;
}

/**
 * Clean up expired challenges (can be called periodically)
 */
export async function cleanupExpiredChallenges(): Promise<number> {
  const result = await prisma.authChallenge.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}
