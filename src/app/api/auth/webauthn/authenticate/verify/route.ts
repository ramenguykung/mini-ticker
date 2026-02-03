import { NextRequest, NextResponse } from 'next/server';
import { verifyWebAuthnAuthentication } from '@/lib/webauthn';
import { z } from 'zod';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

const requestSchema = z.object({
  checkInId: z.string().uuid(),
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
    const { checkInId, credential } = requestSchema.parse(body);

    // Cast to AuthenticationResponseJSON for the library
    const result = await verifyWebAuthnAuthentication(
      checkInId,
      credential as unknown as AuthenticationResponseJSON
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, verified: true });
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
