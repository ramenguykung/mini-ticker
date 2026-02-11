import { NextRequest, NextResponse } from 'next/server';
import { verifySoftwareSignature } from '@/lib/crypto';
import { z } from 'zod';

const requestSchema = z.object({
  anonymousId: z.string().min(1).max(100),
  keyFingerprint: z.string(),
  challenge: z.string(),
  signature: z.string(),
});

/**
 * POST /api/auth/software/verify - Verify a software crypto key signature
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
    
    const { anonymousId, keyFingerprint, challenge, signature } = requestSchema.parse(body);

    const result = await verifySoftwareSignature(
      anonymousId,
      keyFingerprint,
      challenge,
      signature
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

    console.error('Error verifying software signature:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
