import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfferType } from '@prisma/client';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { v4 as uuid } from 'uuid';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

// ── Types ──────────────────────────────────────────

interface SlotSearchParams {
  salonId: string;
  serviceId: string;
  animalId: string;
  offerType: OfferType;
}

export interface AvailableSlot {
  start: string;   // ISO
  end: string;      // ISO
  tableId: string;
  staffId: string;
  durationMinutes: number;
}

export interface FormationSlotResult {
  date: string;     // YYYY-MM-DD
  blockName: string;
  blockStart: string;
  blockEnd: string;
  tableId: string;
  staffId: string;
}

// ── Service ────────────────────────────────────────

@Injectable()
export class SlotEngineService {
  constructor(private prisma: PrismaService) {}

  // ─── PUBLIC API ──────────────────────────────────

  async generateSlots(params: SlotSearchParams) {
    const { salonId, serviceId, animalId, offerType } = params;

    const [service, config, animal] = await Promise.all([
      this.prisma.service.findUnique({ where: { id: serviceId } }),
      this.prisma.salonConfig.findFirst({ where: { salonId } }),
      this.prisma.pet.findUnique({ where: { id: animalId } }),
    ]);

    if (!service) throw new NotFoundException('Service non trouvé');
    if (!animal) throw new NotFoundException('Animal non trouvé');

    // Defaults if no config exists yet
    const horizon = config?.planningHorizonDays ?? 14;
    const granularity = config?.slotGranularityMin ?? 30;
    const formationBlocks = (config?.formationBlocks as any[]) ?? [
      { name: 'Matin', start: '09:00', end: '13:00' },
      { name: 'Après-midi', start: '13:00', end: '17:00' },
    ];

    if (offerType === 'FORMATION') {
      return { formation: await this.generateFormation(salonId, service, formationBlocks, horizon) };
    }
    return { pro: await this.generatePro(salonId, service, animal, granularity, horizon) };
  }

  async acquireLock(slotKey: string): Promise<{ token: string; expiresAt: Date }> {
    // Clean expired locks first
    await this.cleanExpiredLocks();

    const existing = await this.prisma.slotLock.findFirst({
      where: { slotKey, expiresAt: { gt: new Date() } },
    });
    if (existing) throw new BadRequestException('Ce créneau est déjà réservé par quelqu\'un d\'autre');

    const lock = await this.prisma.slotLock.create({
      data: {
        slotKey,
        expiresAt: dayjs().add(5, 'minute').toDate(),
      },
    });

    return { token: lock.id, expiresAt: lock.expiresAt };
  }

  async validateLock(lockToken: string): Promise<boolean> {
    const lock = await this.prisma.slotLock.findUnique({ where: { id: lockToken } });
    if (!lock) return false;
    if (dayjs(lock.expiresAt).isBefore(dayjs())) {
      await this.prisma.slotLock.delete({ where: { id: lockToken } }).catch(() => {});
      return false;
    }
    return true;
  }

  async releaseLock(lockToken: string) {
    await this.prisma.slotLock.delete({ where: { id: lockToken } }).catch(() => {});
  }

  async findNextAvailable(params: SlotSearchParams, afterDate: Date): Promise<AvailableSlot | FormationSlotResult | null> {
    const result = await this.generateSlots(params);
    const after = dayjs(afterDate);

    if ('pro' in result && result.pro) {
      for (const [, slots] of Object.entries(result.pro)) {
        for (const slot of slots) {
          if (dayjs(slot.start).isAfter(after)) return slot;
        }
      }
    }
    if ('formation' in result && result.formation) {
      for (const [, slots] of Object.entries(result.formation)) {
        for (const slot of slots) {
          if (dayjs(slot.date).isAfter(after)) return slot;
        }
      }
    }
    return null;
  }

  async cleanExpiredLocks() {
    await this.prisma.slotLock.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  // ─── PRIVATE: PRO SLOTS ─────────────────────────

  private async generatePro(
    salonId: string,
    service: any,
    animal: any,
    granularity: number,
    horizon: number,
  ): Promise<Record<string, AvailableSlot[]>> {
    const [tables, staff, workingHours, absences, existingAppts, blocks] = await Promise.all([
      this.prisma.groomingTable.findMany({ where: { salonId, isActive: true } }),
      this.prisma.staffMember.findMany({
        where: { salonId, role: 'PRO' },
        include: { serviceDurations: { where: { serviceId: service.id } } },
      }),
      this.prisma.workingHours.findMany({ where: { providerId: salonId } }),
      this.prisma.providerAbsence.findMany({
        where: { providerId: salonId, endDate: { gte: new Date() } },
      }),
      this.prisma.appointment.findMany({
        where: {
          salonId,
          status: { notIn: ['CANCELLED', 'REJECTED', 'NO_SHOW'] },
          slotEnd: { gte: new Date() },
        },
      }),
      this.prisma.manualBlock.findMany({ where: { salonId } }),
    ]);

    if (tables.length === 0 || staff.length === 0) return {};

    const result: Record<string, AvailableSlot[]> = {};

    for (let d = 0; d < horizon; d++) {
      const day = dayjs().add(d, 'day').startOf('day');
      const dayOfWeek = day.day();
      const dayStr = day.format('YYYY-MM-DD');

      const wh = workingHours.find((w) => w.dayOfWeek === dayOfWeek);
      if (!wh) continue;

      // Check full-day absence
      const isAbsent = absences.some(
        (a) => dayjs(a.startDate).isSameOrBefore(day, 'day') && dayjs(a.endDate).isSameOrAfter(day, 'day'),
      );
      if (isAbsent) continue;

      const workStart = this.parseTime(day, wh.startTime);
      const workEnd = this.parseTime(day, wh.endTime);
      const breakStart = wh.breakStartTime ? this.parseTime(day, wh.breakStartTime) : null;
      const breakEnd = wh.breakEndTime ? this.parseTime(day, wh.breakEndTime) : null;

      const daySlots: AvailableSlot[] = [];

      // Iterate over candidate time slots
      let cursor = workStart;
      while (cursor.isBefore(workEnd)) {
        for (const staffMember of staff) {
          // Get duration for this staff (override or default)
          const duration = staffMember.serviceDurations[0]?.durationMinutes ?? service.defaultDurationPro;
          const slotEnd = cursor.add(duration, 'minute');

          if (slotEnd.isAfter(workEnd)) continue;

          // Check break overlap
          if (breakStart && breakEnd && cursor.isBefore(breakEnd) && slotEnd.isAfter(breakStart)) continue;

          // Check staff schedule (from JSON)
          if (!this.isStaffAvailable(staffMember, day, cursor, slotEnd)) continue;

          // Find a compatible free table
          const freeTable = tables.find((table) => {
            // Check existing appointments on this table
            const hasConflict = existingAppts.some(
              (a) =>
                a.tableId === table.id &&
                cursor.isBefore(dayjs(a.slotEnd)) &&
                slotEnd.isAfter(dayjs(a.slotStart)),
            );
            if (hasConflict) return false;

            // Check manual blocks
            if (this.isBlockedByManualBlock(blocks, day, cursor, slotEnd, table.id, staffMember.id)) return false;

            return true;
          });

          if (!freeTable) continue;

          // Check staff not already booked
          const staffBusy = existingAppts.some(
            (a) =>
              a.staffId === staffMember.id &&
              cursor.isBefore(dayjs(a.slotEnd)) &&
              slotEnd.isAfter(dayjs(a.slotStart)),
          );
          if (staffBusy) continue;

          // Avoid duplicates at same start time
          if (!daySlots.some((s) => s.start === cursor.toISOString())) {
            daySlots.push({
              start: cursor.toISOString(),
              end: slotEnd.toISOString(),
              tableId: freeTable.id,
              staffId: staffMember.id,
              durationMinutes: duration,
            });
          }
        }
        cursor = cursor.add(granularity, 'minute');
      }

      if (daySlots.length > 0) {
        // Sort by time
        daySlots.sort((a, b) => a.start.localeCompare(b.start));
        result[dayStr] = daySlots;
      }
    }

    return result;
  }

  // ─── PRIVATE: FORMATION SLOTS ───────────────────

  private async generateFormation(
    salonId: string,
    service: any,
    formationBlocks: any[],
    horizon: number,
  ): Promise<Record<string, FormationSlotResult[]>> {
    const [tables, staff, existingAppts, blocks] = await Promise.all([
      this.prisma.groomingTable.findMany({ where: { salonId, isActive: true } }),
      this.prisma.staffMember.findMany({ where: { salonId } }),
      this.prisma.appointment.findMany({
        where: {
          salonId,
          status: { notIn: ['CANCELLED', 'REJECTED', 'NO_SHOW'] },
          slotEnd: { gte: new Date() },
        },
      }),
      this.prisma.manualBlock.findMany({ where: { salonId } }),
    ]);

    const apprentis = staff.filter((s) => s.role === 'APPRENTI');
    const pros = staff.filter((s) => s.role === 'PRO');
    if (apprentis.length === 0 || pros.length === 0) return {};

    const result: Record<string, FormationSlotResult[]> = {};

    for (let d = 0; d < horizon; d++) {
      const day = dayjs().add(d, 'day').startOf('day');
      const dayStr = day.format('YYYY-MM-DD');

      // Check if a PRO (supervisor) is present this day
      const hasSupervisor = pros.some((p) => this.isStaffAvailableDay(p, day));
      if (!hasSupervisor) continue;

      const daySlots: FormationSlotResult[] = [];

      for (const block of formationBlocks) {
        const blockStart = this.parseTime(day, block.start);
        const blockEnd = this.parseTime(day, block.end);
        const blockDuration = blockEnd.diff(blockStart, 'minute');

        // Find an available apprenti for this block
        const availableApprenti = apprentis.find((a) => {
          if (!this.isStaffAvailable(a, day, blockStart, blockEnd)) return false;
          // Check not already booked
          const busy = existingAppts.some(
            (appt) =>
              appt.staffId === a.id &&
              blockStart.isBefore(dayjs(appt.slotEnd)) &&
              blockEnd.isAfter(dayjs(appt.slotStart)),
          );
          return !busy;
        });

        if (!availableApprenti) continue;

        // Find a free table for the whole block
        const freeTable = tables.find((table) => {
          const hasConflict = existingAppts.some(
            (a) =>
              a.tableId === table.id &&
              blockStart.isBefore(dayjs(a.slotEnd)) &&
              blockEnd.isAfter(dayjs(a.slotStart)),
          );
          if (hasConflict) return false;
          if (this.isBlockedByManualBlock(blocks, day, blockStart, blockEnd, table.id, availableApprenti.id)) return false;
          return true;
        });

        if (!freeTable) continue;

        daySlots.push({
          date: dayStr,
          blockName: block.name,
          blockStart: blockStart.toISOString(),
          blockEnd: blockEnd.toISOString(),
          tableId: freeTable.id,
          staffId: availableApprenti.id,
        });
      }

      if (daySlots.length > 0) {
        result[dayStr] = daySlots;
      }
    }

    return result;
  }

  // ─── PRIVATE: HELPERS ───────────────────────────

  private parseTime(day: dayjs.Dayjs, time: string): dayjs.Dayjs {
    const [h, m] = time.split(':').map(Number);
    return day.hour(h).minute(m).second(0).millisecond(0);
  }

  private isStaffAvailableDay(staff: any, day: dayjs.Dayjs): boolean {
    const schedule = staff.weeklySchedule as any[];
    if (!Array.isArray(schedule) || schedule.length === 0) return true; // No schedule = always available
    const dayOfWeek = day.day();
    return schedule.some((s: any) => s.dayOfWeek === dayOfWeek);
  }

  private isStaffAvailable(staff: any, day: dayjs.Dayjs, slotStart: dayjs.Dayjs, slotEnd: dayjs.Dayjs): boolean {
    // Check leaves
    const leaves = staff.leaves as any[];
    if (Array.isArray(leaves)) {
      const onLeave = leaves.some(
        (l: any) => dayjs(l.startDate).isSameOrBefore(day, 'day') && dayjs(l.endDate).isSameOrAfter(day, 'day'),
      );
      if (onLeave) return false;
    }

    // Check weekly schedule
    const schedule = staff.weeklySchedule as any[];
    if (!Array.isArray(schedule) || schedule.length === 0) return true;
    const dayOfWeek = day.day();
    const daySchedule = schedule.find((s: any) => s.dayOfWeek === dayOfWeek);
    if (!daySchedule) return false;

    const schedStart = this.parseTime(day, daySchedule.startTime);
    const schedEnd = this.parseTime(day, daySchedule.endTime);
    return slotStart.isSameOrAfter(schedStart) && slotEnd.isSameOrBefore(schedEnd);
  }

  private isBlockedByManualBlock(
    blocks: any[],
    day: dayjs.Dayjs,
    slotStart: dayjs.Dayjs,
    slotEnd: dayjs.Dayjs,
    tableId: string,
    staffId: string,
  ): boolean {
    return blocks.some((block) => {
      if (!dayjs(block.date).isSame(day, 'day')) return false;

      let overlaps = false;
      switch (block.type) {
        case 'FULL_DAY':
          overlaps = true;
          break;
        case 'HALF_DAY':
          if (block.halfDay === 'MORNING') {
            overlaps = slotStart.hour() < 13;
          } else {
            overlaps = slotEnd.hour() >= 13 || (slotEnd.hour() === 13 && slotEnd.minute() > 0);
          }
          break;
        case 'TIME_RANGE': {
          const blockStart = this.parseTime(day, block.startTime);
          const blockEnd = this.parseTime(day, block.endTime);
          overlaps = slotStart.isBefore(blockEnd) && slotEnd.isAfter(blockStart);
          break;
        }
      }

      if (!overlaps) return false;

      switch (block.scope) {
        case 'SALON':
          return true;
        case 'TABLE':
          return block.targetTableId === tableId;
        case 'STAFF':
          return block.targetStaffId === staffId;
        default:
          return false;
      }
    });
  }
}
