import { NextRequest, NextResponse } from 'next/server';
import { listPasskeys } from '@/lib/webauthn';

/**
 * GET /api/auth/passkeys?anonymousId=xxx
 * List all passkeys for an anonymousId
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const anonymousId = searchParams.get('anonymousId');

    if (!anonymousId) {
      return NextResponse.json(
        { error: 'anonymousId is required' },
        { status: 400 }
      );
    }

    const passkeys = await listPasskeys(anonymousId);
    return NextResponse.json({ passkeys });
  } catch (error) {
    console.error('Error listing passkeys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
