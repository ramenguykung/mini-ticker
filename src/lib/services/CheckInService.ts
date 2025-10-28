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
            
            // No duplicate anonymousId check - multiple users can share the same anonymousId
            // Each check-in is uniquely identified by its checkInId (UUID primary key)
            
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
                cacheStrategy: {
                    ttl: 5,
                    swr: 15
                },
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
    async getAllCheckIns(bypassCache = false) {
        try {
            const cacheConfig = bypassCache 
                ? { ttl: 0, swr: 0 } 
                : { ttl: 2, swr: 8 };
            
            const checkIns = await prisma.checkIn.findMany({
                cacheStrategy: cacheConfig,
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
     * Get check-in by anonymous ID (returns the most recent active check-in)
     */
    async getByAnonymousId(anonymousId: string) {
        try {
            const checkIn = await prisma.checkIn.findFirst({
                cacheStrategy: {
                    ttl: 5,
                    swr: 15
                },
                where: { anonymousId },
                orderBy: { checkInTime: 'desc' },
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
     * Get active check-in by anonymous ID
     */
    async getActiveCheckInByAnonymousId(anonymousId: string) {
        try {
            const checkIn = await prisma.checkIn.findFirst({
                where: { 
                    anonymousId,
                    status: 'active'
                },
                orderBy: { checkInTime: 'desc' },
            });

            return {
                success: true,
                data: checkIn,
            };
        } catch (error) {
            console.error('Error fetching active check-in:', error);
            return {
                success: false,
                error: 'Failed to fetch active check-in',
            };
        }
    }

    /**
     * Get all check-ins for a specific anonymous ID
     */
    async getAllCheckInsByAnonymousId(anonymousId: string) {
        try {
            const checkIns = await prisma.checkIn.findMany({
                where: { anonymousId },
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
     * Check out a user (update status and set checkout time)
     */
    async checkOut(id: string, anonymousId?: string) {
        try {
            // If anonymousId is provided, verify it matches the check-in record
            if (anonymousId) {
                const checkIn = await prisma.checkIn.findUnique({
                    where: { id },
                });

                if (!checkIn) {
                    return {
                        success: false,
                        error: 'Check-in not found',
                    };
                }

                if (checkIn.anonymousId !== anonymousId) {
                    return {
                        success: false,
                        error: 'Unauthorized: Anonymous ID does not match',
                    };
                }
            }

            return this.update(id, {
                status: 'checked-out',
                checkOutTime: new Date(),
            });
        } catch (error) {
            console.error('Error checking out:', error);
            return {
                success: false,
                error: 'Failed to check out',
            };
        }
    }
}