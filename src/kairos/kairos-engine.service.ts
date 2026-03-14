import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { 
  AnimalData, StaffData, QuoteResult, ClientBlockedException 
} from '../engine/types';
import { resolveAnimal } from '../engine/animal-resolver';
import { findBaseRule, computeTheoreticalDuration, buildQuote } from '../engine/duration-engine';
import { getActiveModifiers, getStaffSpecificModifiers } from '../engine/modifier-evaluator';
import { isAvailable, BookingData, WorkingDay } from './availability-checker';
import { hasCapacity, BookingWithCategoryData } from './capacity-checker';
import { SlotDto, DaySlotsDto } from './dto/slot.dto';

interface KairosGenerateInput {
  clientId: string;
  salonId: string;
  serviceId: string;
  animal: AnimalData;
}

@Injectable()
export class KairosEngineService {
  private readonly logger = new Logger(KairosEngineService.name);

  constructor(private prisma: PrismaService) {}

  async generate(input: KairosGenerateInput): Promise<DaySlotsDto[]> {
    const { clientId, salonId, serviceId, animal } = input;
    
    // Horizon constants
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfHorizon = new Date(today);
    
    // We don't have the horizon value yet, we will fetch config first or default to 14 days
    const config = await this.prisma.salonConfig.findUnique({ where: { salonId } });
    if (!config) throw new Error('Salon config not found');
    
    const horizonDays = config.planningHorizonDays || 14;
    const granularity = config.slotGranularityMin || 15;
    endOfHorizon.setDate(endOfHorizon.getDate() + horizonDays);

    // GATE 0: Check blocked client
    const user = await this.prisma.user.findUnique({ where: { id: clientId } });
    if (user?.isBlocked) {
      throw new ClientBlockedException(`Client ${clientId} is blocked: ${user.blockedReason || 'No reason specified'}`);
    }

    // ---------------------------------------------------------
    // BULK FETCH
    // ---------------------------------------------------------
    const [
      staffMembers,
      workingHours,
      absences,
      allAppointmentsDb,
      manualBlocks,
      baseRules,
      modifierRules,
      latestRefinement
    ] = await Promise.all([
      this.prisma.staffMember.findMany({ where: { salonId } }),
      this.prisma.workingHours.findMany({ where: { providerId: salonId } }),
      this.prisma.providerAbsence.findMany({ where: { providerId: salonId, endDate: { gte: today } } }),
      this.prisma.appointment.findMany({
        where: {
          salonId,
          status: { in: ['CONFIRMED', 'PENDING', 'IN_PROGRESS'] },
          slotStart: { gte: today, lte: endOfHorizon },
        },
        include: { pet: true },
        orderBy: { slotStart: 'asc' }
      }),
      this.prisma.manualBlock.findMany({ 
        where: { 
          salonId, 
          date: { gte: today, lte: endOfHorizon } 
        } 
      }),
      this.prisma.baseRule.findMany({ where: { salonId } }),
      this.prisma.modifierRule.findMany({ where: { salonId, isActive: true } }),
      this.prisma.animalRefinement.findFirst({
        where: { animalId: animal.id },
        orderBy: { createdAt: 'desc' },
      })
    ]);

    // Map DB appointments to the interfaces expected by checkers
    const allAppointments: BookingWithCategoryData[] = allAppointmentsDb.map(a => ({
      id: a.id,
      staffId: a.staffId,
      status: a.status,
      slotStart: a.slotStart,
      slotEnd: a.slotEnd,
      petCategory: a.pet.category
    }));

    // Map WorkingHours 
    const salonWorkingHours: WorkingDay[] = workingHours.map(wh => ({
      dayOfWeek: wh.dayOfWeek,
      startTime: wh.startTime,
      endTime: wh.endTime,
      breakStartTime: wh.breakStartTime,
      breakEndTime: wh.breakEndTime
    }));

    const concurrentLimits = typeof config.concurrentLimits === 'string' 
      ? JSON.parse(config.concurrentLimits) 
      : config.concurrentLimits;

    // ---------------------------------------------------------
    // 2-LEVEL COMPUTATION (Outside staff loop)
    // ---------------------------------------------------------
    const resolvedAnimal = resolveAnimal(animal, latestRefinement);
    const baseRule = findBaseRule(baseRules, serviceId, resolvedAnimal.weightKg);
    const activeModifiers = getActiveModifiers(modifierRules, resolvedAnimal, null); // HasKnots isn't passed here unless known upfront
    const T_theoretical = computeTheoreticalDuration(baseRule, activeModifiers);
    
    // GATE 1 & Loop setup
    const response: DaySlotsDto[] = [];

    for (let dayOffset = 0; dayOffset <= horizonDays; dayOffset++) {
      const currentDay = new Date(today);
      currentDay.setDate(today.getDate() + dayOffset);
      const dayOfWeek = currentDay.getDay();

      // Gate 1: isSalonOpen
      const dayHours = salonWorkingHours.find(wh => wh.dayOfWeek === dayOfWeek);
      if (!dayHours) continue; // Closed

      // Check Full Day manual block
      const hasFullDayBlock = manualBlocks.some(b => 
        new Date(b.date).toDateString() === currentDay.toDateString() &&
        b.type === 'FULL_DAY' && 
        b.scope === 'SALON'
      );
      if (hasFullDayBlock) continue;

      const [openH, openM] = dayHours.startTime.split(':').map(Number);
      const [closeH, closeM] = dayHours.endTime.split(':').map(Number);
      
      const dayStart = new Date(currentDay);
      dayStart.setHours(openH, openM, 0, 0);
      
      const dayEnd = new Date(currentDay);
      dayEnd.setHours(closeH, closeM, 0, 0);

      const slotsToday: SlotDto[] = [];
      let cursor = new Date(dayStart);

      // Now iterate through slots
      while (cursor < dayEnd) {
        // Evaluate Staff Members
        for (const staff of staffMembers) {
          
          // Gate 2: allowed service
          if (!staff.allowedServiceIds.includes(serviceId)) {
            continue; // Staff not habilitated for this service
          }

          // ---------------------------------------------------------
          // 2-LEVEL COMPUTATION (Inside staff loop)
          // ---------------------------------------------------------
          // We convert Prisma staff object to StaffData implicitly 
          // (need to cast role if necessary but properties match)
          const staffSpecificModifiers = getStaffSpecificModifiers(modifierRules, staff as any);
          const quote = buildQuote(baseRule, T_theoretical, staff as any, staffSpecificModifiers, activeModifiers);

          const slotStart = new Date(cursor);
          const slotEnd = new Date(cursor.getTime() + quote.actualDurationMinutes * 60000);

          // Gate 4: Past closing time
          if (slotEnd > dayEnd) {
            continue;
          }

          // Gate 5: Staff Availability
          if (!isAvailable(staff as any, slotStart, slotEnd, allAppointments, salonWorkingHours, absences)) {
            continue;
          }

          // Gate 6: Capacity Checked
          if (!hasCapacity(resolvedAnimal.category, slotStart, slotEnd, allAppointments, concurrentLimits)) {
            continue;
          }

          slotsToday.push({
            start: slotStart,
            end: slotEnd,
            staffId: staff.id,
            quote
          });
        }

        // Increment cursor
        cursor = new Date(cursor.getTime() + granularity * 60000);
      }

      if (slotsToday.length > 0) {
        response.push({
          date: currentDay.toISOString().split('T')[0],
          slots: slotsToday
        });
      }
    }

    return response;
  }
}
