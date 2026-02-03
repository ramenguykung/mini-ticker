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
 * Generate a fingerprint (SHA-256 hash) of a public key JWK
 */
export function generateKeyFingerprint(publicKeyJwk: JsonWebKey): string {
  const keyString = JSON.stringify(publicKeyJwk);
  return crypto.createHash('sha256').update(keyString).digest('hex');
}

/**
 * Store a challenge for software key verification
 */
export async function storeChallenge(anonymousId: string): Promise<string> {
  const challenge = generateChallenge();
  
  await prisma.authChallenge.create({
    data: {
      anonymousId,
      challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });
  
  return challenge;
}

/**
 * Get and validate a stored challenge
 */
export async function getValidChallenge(anonymousId: string, challenge: string): Promise<boolean> {
  const storedChallenge = await prisma.authChallenge.findFirst({
    where: {
      anonymousId,
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
 * Store a software public key for an anonymousId
 */
export async function storeSoftwareKey(
  anonymousId: string,
  publicKeyJwk: JsonWebKey
): Promise<{ success: boolean; keyFingerprint?: string; error?: string }> {
  try {
    const keyFingerprint = generateKeyFingerprint(publicKeyJwk);

    // Check if this exact key already exists
    const existing = await prisma.softwareKey.findUnique({
      where: { keyFingerprint },
    });

    if (existing) {
      // Key already exists, return its fingerprint
      return { success: true, keyFingerprint };
    }

    // Create new key
    await prisma.softwareKey.create({
      data: {
        anonymousId,
        keyFingerprint,
        publicKeyJwk: JSON.stringify(publicKeyJwk),
      },
    });

    return { success: true, keyFingerprint };
  } catch (error) {
    console.error('Error storing software key:', error);
    return { success: false, error: 'Failed to store software key' };
  }
}

/**
 * Verify a signature using a stored software public key (by fingerprint)
 */
export async function verifySoftwareSignature(
  anonymousId: string,
  keyFingerprint: string,
  challenge: string,
  signatureBase64: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the stored public key by fingerprint
    const softwareKey = await prisma.softwareKey.findUnique({
      where: { keyFingerprint },
    });

    if (!softwareKey) {
      return { success: false, error: 'No software key found' };
    }

    // Verify the key belongs to this anonymousId
    if (softwareKey.anonymousId !== anonymousId) {
      return { success: false, error: 'Key does not belong to this user' };
    }

    // Validate the challenge
    const isValidChallenge = await getValidChallenge(anonymousId, challenge);
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
 */
function convertP1363ToDER(signature: Buffer): Buffer {
  const r = signature.subarray(0, 32);
  const s = signature.subarray(32, 64);

  const rPadded = addLeadingZeroIfNeeded(trimLeadingZeros(r));
  const sPadded = addLeadingZeroIfNeeded(trimLeadingZeros(s));

  const rLen = rPadded.length;
  const sLen = sPadded.length;
  const totalLen = 2 + rLen + 2 + sLen;

  const der = Buffer.alloc(2 + totalLen);
  let offset = 0;

  der[offset++] = 0x30; // SEQUENCE
  der[offset++] = totalLen;
  der[offset++] = 0x02; // INTEGER
  der[offset++] = rLen;
  rPadded.copy(der, offset);
  offset += rLen;
  der[offset++] = 0x02; // INTEGER
  der[offset++] = sLen;
  sPadded.copy(der, offset);

  return der;
}

function trimLeadingZeros(buf: Buffer): Buffer {
  let i = 0;
  while (i < buf.length - 1 && buf[i] === 0) {
    i++;
  }
  return buf.subarray(i);
}

function addLeadingZeroIfNeeded(buf: Buffer): Buffer {
  if (buf[0] & 0x80) {
    return Buffer.concat([Buffer.from([0x00]), buf]);
  }
  return buf;
}

/**
 * Check if an anonymousId has a software key registered
 */
export async function hasSoftwareKey(anonymousId: string): Promise<boolean> {
  const count = await prisma.softwareKey.count({
    where: { anonymousId },
  });
  return count > 0;
}

/**
 * Get software keys for an anonymousId
 */
export async function getSoftwareKeys(anonymousId: string) {
  return prisma.softwareKey.findMany({
    where: { anonymousId },
    select: {
      keyFingerprint: true,
      createdAt: true,
    },
  });
}

/**
 * Check if a specific keyFingerprint exists on the server
 */
export async function verifyKeyExists(
  anonymousId: string,
  keyFingerprint: string
): Promise<boolean> {
  const key = await prisma.softwareKey.findFirst({
    where: {
      anonymousId,
      keyFingerprint,
    },
  });
  return !!key;
}

/**
 * Clean up expired challenges
 */
export async function cleanupExpiredChallenges(): Promise<number> {
  const result = await prisma.authChallenge.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}
