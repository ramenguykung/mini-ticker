import { NextRequest, NextResponse } from 'next/server';
import { hasWebAuthnCredential, verifyCredentialExists } from '@/lib/webauthn';
import { hasSoftwareKey, verifyKeyExists } from '@/lib/crypto';
import { z } from 'zod';

const requestSchema = z.object({
  anonymousId: z.string().min(1).max(100),
  credentialId: z.string().optional(),
  keyFingerprint: z.string().optional(),
});

/**
 * POST /api/auth/credentials/check - Check if credentials exist for an anonymousId
 * 
 * If credentialId or keyFingerprint is provided, checks if that specific credential exists.
 * Otherwise, checks if any credentials exist for the anonymousId.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { anonymousId, credentialId, keyFingerprint } = requestSchema.parse(body);

    // Check for specific credential if provided
    if (credentialId) {
      const exists = await verifyCredentialExists(anonymousId, credentialId);
      return NextResponse.json({
        hasCredentials: exists,
        method: exists ? 'webauthn' : null,
        credentialValid: exists,
      });
    }

    if (keyFingerprint) {
      const exists = await verifyKeyExists(anonymousId, keyFingerprint);
      return NextResponse.json({
        hasCredentials: exists,
        method: exists ? 'software' : null,
        credentialValid: exists,
      });
    }

    // Check for any credentials
    const hasWebAuthn = await hasWebAuthnCredential(anonymousId);
    const hasSoftware = await hasSoftwareKey(anonymousId);

    return NextResponse.json({
      hasCredentials: hasWebAuthn || hasSoftware,
      method: hasWebAuthn ? 'webauthn' : hasSoftware ? 'software' : null,
      hasWebAuthn,
      hasSoftware,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error checking credentials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
