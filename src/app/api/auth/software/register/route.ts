import { NextRequest, NextResponse } from 'next/server';
import { storeSoftwareKey } from '@/lib/crypto';
import { z } from 'zod';

const requestSchema = z.object({
  checkInId: z.string().uuid(),
  publicKeyJwk: z.object({
    kty: z.literal('EC'),
    crv: z.literal('P-256'),
    x: z.string(),
    y: z.string(),
  }),
});

/**
 * POST /api/auth/software/register - Store a software crypto public key
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { checkInId, publicKeyJwk } = requestSchema.parse(body);

    const result = await storeSoftwareKey(checkInId, publicKeyJwk);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error storing software key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
