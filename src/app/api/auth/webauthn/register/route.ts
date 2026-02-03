import { NextRequest, NextResponse } from 'next/server';
import { generateWebAuthnRegistrationOptions } from '@/lib/webauthn';
import { z } from 'zod';

const requestSchema = z.object({
  anonymousId: z.string().min(1).max(100),
});

/**
 * POST /api/auth/webauthn/register - Generate WebAuthn registration options
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { anonymousId } = requestSchema.parse(body);

    const options = await generateWebAuthnRegistrationOptions(anonymousId);

    return NextResponse.json(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error generating registration options:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
