import { NextRequest, NextResponse } from 'next/server';
import { generateWebAuthnAuthenticationOptions } from '@/lib/webauthn';
import { z } from 'zod';

const requestSchema = z.object({
  anonymousId: z.string().min(1).max(100),
  credentialId: z.string().optional(), // Optional: if provided, only allow this specific credential
});

/**
 * POST /api/auth/webauthn/authenticate - Generate WebAuthn authentication options
 */
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    const { anonymousId, credentialId } = requestSchema.parse(body);

    const options = await generateWebAuthnAuthenticationOptions(anonymousId, credentialId);

    if (!options) {
      return NextResponse.json(
        { error: 'No credentials found for this user' },
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
