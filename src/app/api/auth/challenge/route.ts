import { NextRequest, NextResponse } from 'next/server';
import { storeChallenge } from '@/lib/crypto';
import { z } from 'zod';

const requestSchema = z.object({
  checkInId: z.string().uuid(),
});

/**
 * POST /api/auth/challenge - Generate a challenge for software key authentication
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { checkInId } = requestSchema.parse(body);

    const challenge = await storeChallenge(checkInId);

    return NextResponse.json({ challenge });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error generating challenge:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
