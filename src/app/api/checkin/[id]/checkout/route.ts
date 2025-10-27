import { NextRequest, NextResponse } from 'next/server';
import { CheckInService } from '@/lib/services/CheckInService';

const service = new CheckInService();

/**
 * POST /api/checkin/[id]/checkout - Check out a user
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const result = await service.checkOut(id);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: result.error === 'Check-in not found' ? 404 : 400 }
            );
        }

        return NextResponse.json(result.data);
    } catch (error) {
        console.error('Checkout error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
