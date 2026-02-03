import { NextRequest, NextResponse } from 'next/server';
import { verifySoftwareSignature } from '@/lib/crypto';
import { z } from 'zod';

const requestSchema = z.object({
  checkInId: z.string().uuid(),
  challenge: z.string().min(1),
  signature: z.string().min(1),
});

/**
 * POST /api/auth/software/verify - Verify a software key signature
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { checkInId, challenge, signature } = requestSchema.parse(body);

    const result = await verifySoftwareSignature(checkInId, challenge, signature);

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

    console.error('Error verifying signature:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
