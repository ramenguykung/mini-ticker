import { NextRequest, NextResponse } from 'next/server';
import { generateWebAuthnAuthenticationOptions } from '@/lib/webauthn';
import { z } from 'zod';

const requestSchema = z.object({
  checkInId: z.string().uuid(),
});

/**
 * POST /api/auth/webauthn/authenticate - Generate WebAuthn authentication options
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { checkInId } = requestSchema.parse(body);

    const options = await generateWebAuthnAuthenticationOptions(checkInId);

    if (!options) {
      return NextResponse.json(
        { error: 'No WebAuthn credential found for this check-in' },
        { status: 404 }
      );
    }

    return NextResponse.json(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error generating authentication options:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
