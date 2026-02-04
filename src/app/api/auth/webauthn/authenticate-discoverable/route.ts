import { NextRequest, NextResponse } from 'next/server';
import { 
  generateDiscoverableAuthenticationOptions, 
  verifyDiscoverableAuthentication 
} from '@/lib/webauthn';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

/**
 * POST /api/auth/webauthn/authenticate-discoverable
 * Start discoverable credential authentication (no anonymousId required)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // If credential is provided, verify it (step 2)
    if (body.credential) {
      const credential = body.credential as AuthenticationResponseJSON;
      const result = await verifyDiscoverableAuthentication(credential);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Authentication failed' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        anonymousId: result.anonymousId,
        credentialId: result.credentialId,
      });
    }

    // Otherwise, generate options (step 1)
    const options = await generateDiscoverableAuthenticationOptions();
    return NextResponse.json(options);
  } catch (error) {
    console.error('Discoverable authentication error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
