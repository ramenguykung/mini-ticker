import { NextRequest, NextResponse } from 'next/server';
import { renamePasskey, deletePasskey } from '@/lib/webauthn';

/**
 * PATCH /api/auth/passkeys/:id
 * Rename a passkey
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { anonymousId, name } = body;

    if (!anonymousId || !name) {
      return NextResponse.json(
        { error: 'anonymousId and name are required' },
        { status: 400 }
      );
    }

    const result = await renamePasskey(id, anonymousId, name);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to rename passkey' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error renaming passkey:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/passkeys/:id
 * Delete a passkey
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const anonymousId = searchParams.get('anonymousId');

    if (!anonymousId) {
      return NextResponse.json(
        { error: 'anonymousId is required' },
        { status: 400 }
      );
    }

    const result = await deletePasskey(id, anonymousId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete passkey' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting passkey:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
