import { NextRequest, NextResponse } from 'next/server';
import { CheckInService } from '@/lib/services/CheckInService';
import { z } from 'zod';

const updateSchema = z.object({
    status: z.string().optional(),
    checkOutTime: z.string().datetime().optional(),
});

const service = new CheckInService();

/**
 * PATCH /api/checkin/[id] - Update a check-in
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const validatedData = updateSchema.parse(body);

        const updateData = {
            ...validatedData,
            checkOutTime: validatedData.checkOutTime 
                ? new Date(validatedData.checkOutTime) 
                : undefined,
        };

        const result = await service.update(id, updateData);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
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

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/checkin/[id] - Delete a check-in
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const result = await service.delete(id);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ message: result.message });
    } catch {
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

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
                { status: 400 }
            );
        }

        return NextResponse.json(result.data);
    } catch {
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}