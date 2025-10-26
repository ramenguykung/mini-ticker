import { NextRequest, NextResponse } from 'next/server';
import { CheckInService } from '@/lib/services/CheckInService';
import { z } from 'zod';

const checkInSchema = z.object({
    anonymousId: z.string().optional(),
    deviceInfo: z.string().optional(),
});

const service = new CheckInService();

/**
 * POST /api/checkin - Create a new check-in
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validatedData = checkInSchema.parse(body);

        const result = await service.insert(validatedData);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json(result.data, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid input', details: error.errors },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/checkin - Get all active check-ins
 */
export async function GET() {
    try {
        const result = await service.getActiveCheckIns();

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json(result.data);
    } catch (error) {
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}