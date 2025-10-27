import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export interface CheckInData {
    anonymousId?: string;
    deviceInfo?: string;
}

export interface UpdateCheckInData {
    status?: string;
    checkOutTime?: Date;
}

export class CheckInService {
    /**
     * Insert a new check-in record
     */
    async insert(data: CheckInData) {
        try {
            const anonymousId = data.anonymousId || uuidv4();
            
            const checkIn = await prisma.checkIn.create({
                data: {
                    anonymousId,
                    deviceInfo: data.deviceInfo,
                    status: 'active',
                },
            });

            return {
                success: true,
                data: checkIn,
            };
        } catch (error) {
            console.error('Error inserting check-in:', error);
            return {
                success: false,
                error: 'Failed to create check-in',
            };
        }
    }

    /**
     * Update an existing check-in record
     */
    async update(id: string, data: UpdateCheckInData) {
        try {
            const checkIn = await prisma.checkIn.update({
                where: { id },
                data: {
                    ...data,
                    updatedAt: new Date(),
                },
            });

            return {
                success: true,
                data: checkIn,
            };
        } catch (error) {
            console.error('Error updating check-in:', error);
            return {
                success: false,
                error: 'Failed to update check-in',
            };
        }
    }

    /**
     * Delete a check-in record
     */
    async delete(id: string) {
        try {
            await prisma.checkIn.delete({
                where: { id },
            });

            return {
                success: true,
                message: 'Check-in deleted successfully',
            };
        } catch (error) {
            console.error('Error deleting check-in:', error);
            return {
                success: false,
                error: 'Failed to delete check-in',
            };
        }
    }

    /**
     * Get all active check-ins
     */
    async getActiveCheckIns() {
        try {
            const checkIns = await prisma.checkIn.findMany({
                where: { status: 'active' },
                orderBy: { checkInTime: 'desc' },
            });

            return {
                success: true,
                data: checkIns,
            };
        } catch (error) {
            console.error('Error fetching check-ins:', error);
            return {
                success: false,
                error: 'Failed to fetch check-ins',
            };
        }
    }

    /**
     * Get all check-ins (active and inactive)
     */
    async getAllCheckIns() {
        try {
            const checkIns = await prisma.checkIn.findMany({
                orderBy: { checkInTime: 'desc' },
            });

            return {
                success: true,
                data: checkIns,
            };
        } catch (error) {
            console.error('Error fetching check-ins:', error);
            return {
                success: false,
                error: 'Failed to fetch check-ins',
            };
        }
    }

    /**
     * Get check-in by anonymous ID
     */
    async getByAnonymousId(anonymousId: string) {
        try {
            const checkIn = await prisma.checkIn.findUnique({
                where: { anonymousId },
            });

            return {
                success: true,
                data: checkIn,
            };
        } catch (error) {
            console.error('Error fetching check-in:', error);
            return {
                success: false,
                error: 'Failed to fetch check-in',
            };
        }
    }

    /**
     * Check out a user (update status and set checkout time)
     */
    async checkOut(id: string) {
        return this.update(id, {
            status: 'checked-out',
            checkOutTime: new Date(),
        });
    }
}