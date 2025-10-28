import { NextRequest, NextResponse } from 'next/server';
import { CheckInService } from '@/lib/services/CheckInService';
import { z } from 'zod';

const checkoutSchema = z.object({
    anonymousId: z.string().min(1).max(100).optional(),
});

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
        const body = await request.json();
        const validatedData = checkoutSchema.parse(body);

        const result = await service.checkOut(id, validatedData.anonymousId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: result.error === 'Check-in not found' ? 404 : 
                        result.error === 'Unauthorized: Anonymous ID does not match' ? 403 : 400 }
            );
        }

        return NextResponse.json(result.data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid input', details: error.issues },
                { status: 400 }
            );
        }

        console.error('Checkout error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
