import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LockExpiredException, QuoteResult } from '../engine/types';
import { v4 as uuidv4 } from 'uuid';

interface AcquireLockInput {
  salonId: string;
  staffId: string;
  serviceId: string;
  startTime: Date;
}

interface ConfirmBookingInput {
  clientId: string;
  salonId: string;
  serviceId: string;
  petId: string;
  staffId: string;
  slotStart: Date;
  quoteResult: QuoteResult;
  hasKnotsToday: boolean;
  precautions?: string;
  clientFreeNote?: string;
  lockToken: string;
}

@Injectable()
export class LockManagerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generates a deterministic key for the slot.
   */
  private generateSlotKey(salonId: string, staffId: string, startTime: Date): string {
    return `${salonId}_${staffId}_${startTime.toISOString()}`;
  }

  /**
   * Acquires a temporary lock on a specific slot (staff + time).
   * Valid for 5 minutes.
   */
  async acquireLock(input: AcquireLockInput): Promise<{ lockToken: string; expiresAt: Date }> {
    const slotKey = this.generateSlotKey(input.salonId, input.staffId, input.startTime);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60000); // 5 minutes

    // Clean up expired locks first to free up the key
    await this.prisma.slotLock.deleteMany({
      where: { expiresAt: { lt: now } }
    });

    try {
      // Attempt to create the lock. Will throw P2002 if slotKey is already locked uniquely.
      // Wait, slotKey is not currently marked @unique in schema.prisma, just @index.
      // Let's rely on Prisma transactions or check if an active lock exists.
      return await this.prisma.$transaction(async (tx) => {
        const existingLock = await tx.slotLock.findFirst({
          where: { slotKey, expiresAt: { gt: now } }
        });

        if (existingLock) {
          throw new BadRequestException('Slot already locked or booked concurrently');
        }

        const newLock = await tx.slotLock.create({
          data: { slotKey, expiresAt }
        });

        return { lockToken: newLock.id, expiresAt: newLock.expiresAt };
      });
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Failed to acquire lock for slot');
    }
  }

  /**
   * Confirms a booking using a previously acquired lock token.
   * Creates the Appointment in PENDING state (frozen snapshot).
   */
  async confirmBooking(input: ConfirmBookingInput) {
    const { lockToken, quoteResult } = input;
    const now = new Date();

    const lock = await this.prisma.slotLock.findUnique({ where: { id: lockToken } });
    if (!lock || lock.expiresAt < now) {
      // Find the next available slot suggestion if possible, or omit it
      throw new LockExpiredException('Lock has expired or is invalid. Please restart the booking process.');
    }

    const slotKey = this.generateSlotKey(input.salonId, input.staffId, input.slotStart);
    if (lock.slotKey !== slotKey) {
      throw new BadRequestException('Lock token does not match the requested slot');
    }

    const slotEnd = new Date(input.slotStart.getTime() + quoteResult.actualDurationMinutes * 60000);

    // Create the appointment using the lock
    const appointment = await this.prisma.$transaction(async (tx) => {
       const newAppt = await tx.appointment.create({
         data: {
           clientId: input.clientId,
           salonId: input.salonId,
           serviceId: input.serviceId,
           petId: input.petId,
           staffId: input.staffId,
           slotStart: input.slotStart,
           slotEnd,
           
           // Snapshot from QuoteResult
           theoreticalDurationMinutes: quoteResult.theoreticalDurationMinutes,
           actualDurationMinutes: quoteResult.actualDurationMinutes,
           clientDurationMax: quoteResult.clientDurationMax,
           tableDurationMinutes: quoteResult.tableDurationMinutes,
           estimatedPrice: quoteResult.estimatedPrice,
           priceDisplayMode: quoteResult.priceDisplayMode,
           priceDisplayDisclaimer: quoteResult.priceDisplayDisclaimer,
           appliedModifiers: quoteResult.appliedModifiers,

           // Layer 3
           hasKnotsToday: input.hasKnotsToday,
           precautions: input.precautions,
           clientFreeNote: input.clientFreeNote,
           
           status: 'PENDING',
           lockToken: lock.id,
           lockExpiresAt: lock.expiresAt,
         }
       });

       // Release lock so it can't be reused
       await tx.slotLock.delete({ where: { id: lock.id } });

       return newAppt;
    });

    return appointment;
  }
}
