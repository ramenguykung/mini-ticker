import { NextRequest, NextResponse } from 'next/server';
import { verifyWebAuthnAuthentication } from '@/lib/webauthn';
import { z } from 'zod';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

const requestSchema = z.object({
  anonymousId: z.string().min(1).max(100),
  credential: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      authenticatorData: z.string(),
      signature: z.string(),
      userHandle: z.string().optional(),
    }),
    type: z.literal('public-key'),
    clientExtensionResults: z.object({}).passthrough(),
    authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  }),
});

/**
 * POST /api/auth/webauthn/authenticate/verify - Verify WebAuthn authentication response
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { anonymousId, credential } = requestSchema.parse(body);

    const result = await verifyWebAuthnAuthentication(
      anonymousId,
      credential as unknown as AuthenticationResponseJSON
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      verified: true,
      credentialId: result.credentialId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error verifying authentication:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
