import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AnimalData, QuoteResult, AppointmentNoteData, ClientBlockedException,
} from '../engine/types';
import { resolveAnimal } from '../engine/animal-resolver';
import {
  findBaseRule, computeTheoreticalDurationV2, buildQuoteV2,
  SalonParams, DEFAULT_TRANSITION_BUFFER_MIN, DEFAULT_CLIENT_DURATION_MARGIN_PERCENT,
} from '../engine/duration-engine';
import { getActiveModifiers, getStaffSpecificModifiers, modifiersToEffects } from '../engine/modifier-evaluator';
import { computeDifficultyScore } from '../engine/difficulty-score';
import { RuleContext, RuleEffect, evaluateRules } from '../engine/rule-evaluator';
import { isAvailable, WorkingDay } from './availability-checker';
import { hasCapacity, BookingWithCategoryData } from './capacity-checker';
import {
  hasSupervisionCapacity, isSupervisorBlockedByApprentices,
  SupervisionConfig, SupervisionBooking,
} from './supervision-checker';
import { SlotDto, DaySlotsDto } from './dto/slot.dto';

interface KairosGenerateInput {
  clientId: string;
  salonId: string;
  serviceId: string;
  animal: AnimalData;
}

/** Plan pré-calculé par staff : le devis ne dépend pas du créneau, on le calcule une fois. */
interface StaffPlan {
  staff: any;
  quote: QuoteResult;
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

    // L'horizon de fetch dépend de planningHorizonDays → on lit la config d'abord,
    // puis tout le reste en un seul Promise.all (2 allers-retours au lieu de 4).
    const config = await this.prisma.salonConfig.findUnique({ where: { salonId } });

    const horizonDays = config?.planningHorizonDays ?? 14;
    const granularity = config?.slotGranularityMin ?? 30;
    endOfHorizon.setDate(endOfHorizon.getDate() + horizonDays);

    // ---------------------------------------------------------
    // BULK FETCH
    // ---------------------------------------------------------
    const [
      user,
      visitCount,
      staffMembers,
      workingHours,
      absences,
      allAppointmentsDb,
      manualBlocks,
      baseRules,
      modifierRules,
      salonRules,
      latestRefinement,
    ] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: clientId } }),
      clientId
        ? this.prisma.appointment.count({ where: { salonId, clientId, status: 'COMPLETED' } })
        : Promise.resolve(0),
      this.prisma.staffMember.findMany({ where: { salonId } }),
      this.prisma.workingHours.findMany({ where: { providerId: salonId } }),
      this.prisma.providerAbsence.findMany({ where: { providerId: salonId, endDate: { gte: today } } }),
      this.prisma.appointment.findMany({
        where: {
          salonId,
          status: { in: ['CONFIRMED', 'PENDING', 'IN_PROGRESS'] },
          slotStart: { gte: today, lte: endOfHorizon },
        },
        include: { pet: true, internalPet: true },
        orderBy: { slotStart: 'asc' },
      }),
      this.prisma.manualBlock.findMany({
        where: { salonId, date: { gte: today, lte: endOfHorizon } },
      }),
      this.prisma.baseRule.findMany({ where: { salonId } }),
      this.prisma.modifierRule.findMany({ where: { salonId, isActive: true } }),
      this.prisma.salonRule.findMany({ where: { salonId, isActive: true }, orderBy: { priority: 'asc' } }),
      this.prisma.animalRefinement.findFirst({
        where: { animalId: animal.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // GATE 0: Check blocked client
    if (user?.isBlocked) {
      throw new ClientBlockedException(`Client ${clientId} is blocked: ${user.blockedReason || 'No reason specified'}`);
    }

    // Rôle par staffId (utilisé pour la supervision)
    const staffRoleById = new Map<string, string>(staffMembers.map((s) => [s.id, s.role]));

    // Map DB appointments → interfaces des checkers (on porte aussi le rôle du staff)
    const allAppointments: (BookingWithCategoryData & { staffRole: string })[] = allAppointmentsDb.map((a) => ({
      id: a.id,
      staffId: a.staffId,
      status: a.status,
      slotStart: a.slotStart,
      slotEnd: a.slotEnd,
      petCategory: a.pet?.category ?? a.internalPet?.category ?? 'SMALL',
      staffRole: staffRoleById.get(a.staffId) ?? '',
    }));

    const salonWorkingHours: WorkingDay[] = workingHours.map((wh) => ({
      dayOfWeek: wh.dayOfWeek,
      startTime: wh.startTime,
      endTime: wh.endTime,
      breakStartTime: wh.breakStartTime,
      breakEndTime: wh.breakEndTime,
    }));

    const groomingTables: string[] = config?.groomingTables ?? ['LARGE', 'SMALL'];

    // ---------------------------------------------------------
    // SALON ALGORITHM PARAMETERS
    // ---------------------------------------------------------
    const salonParams: SalonParams = {
      transitionBufferMin: config?.transitionBufferMin ?? DEFAULT_TRANSITION_BUFFER_MIN,
      clientDurationMarginPercent: config?.clientDurationMarginPercent ?? DEFAULT_CLIENT_DURATION_MARGIN_PERCENT,
    };
    const breakBetweenMin = config?.breakBetweenAppointmentsMin ?? 0;

    const supervisionConfig: SupervisionConfig = {
      enabled: config?.supervisionEnabled ?? false,
      supervisorRole: config?.supervisorRole ?? 'PROFESSIONAL',
      superviseeRole: config?.superviseeRole ?? 'APPRENTICE',
      maxConcurrentSupervisions: config?.maxConcurrentSupervisions ?? 3,
      blockSupervisorWhenApprenticeBooked: config?.blockSupervisorWhenApprenticeBooked ?? true,
    };

    // ---------------------------------------------------------
    // PRE-INDEXATION (Map YYYY-MM-DD) POUR LES PERFORMANCES
    // ---------------------------------------------------------
    const formatDateKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const appointmentsByDate = new Map<string, (BookingWithCategoryData & { staffRole: string })[]>();
    for (const appt of allAppointments) {
      const key = formatDateKey(appt.slotStart);
      if (!appointmentsByDate.has(key)) appointmentsByDate.set(key, []);
      appointmentsByDate.get(key)!.push(appt);
    }

    const manualBlocksByDate = new Map<string, typeof manualBlocks>();
    for (const block of manualBlocks) {
      const key = formatDateKey(block.date);
      if (!manualBlocksByDate.has(key)) manualBlocksByDate.set(key, []);
      manualBlocksByDate.get(key)!.push(block);
    }

    // ---------------------------------------------------------
    // CALCUL INDÉPENDANT DU CRÉNEAU (animal + service)
    // ---------------------------------------------------------
    const resolvedAnimal = resolveAnimal(animal, latestRefinement);
    const baseRule = findBaseRule(baseRules, serviceId, resolvedAnimal.weightKg);

    // Note de RDV : à la génération de créneaux, pas de nœuds connus (refinement jour J)
    const note: AppointmentNoteData = { hasKnotsToday: false };

    // Bug 3 fix : difficultyScore réellement calculé (était hardcodé à 0)
    const difficultyScore = computeDifficultyScore(resolvedAnimal, note);

    const daysSinceGroom = resolvedAnimal.lastGroomedAt
      ? Math.floor((Date.now() - resolvedAnimal.lastGroomedAt.getTime()) / (1000 * 3600 * 24))
      : 0;

    // Contexte de base (le staff est rempli dans la boucle staff)
    const baseContext: RuleContext = {
      animal: {
        weightKg: resolvedAnimal.weightKg,
        category: resolvedAnimal.category,
        coatType: resolvedAnimal.coatType,
        groomingBehavior: resolvedAnimal.groomingBehavior,
        skinCondition: resolvedAnimal.skinCondition,
        difficultyScore,
        lastGroomedAt: resolvedAnimal.lastGroomedAt,
        daysSinceGroom,
      },
      staff: { role: 'PROFESSIONAL', speedIndex: 1.0 },
      appointment: {
        hasKnots: false,
        // Première visite = aucun RDV terminé dans CE salon (un animal toiletté
        // ailleurs a un lastGroomedAt non nul mais reste un nouveau client ici).
        isFirstVisit: visitCount === 0,
      },
      client: { visitCount },
    };

    // Effets legacy liés à l'animal (indépendants du staff).
    // On réutilise le difficultyScore déjà calculé pour éviter un recalcul.
    const animalModifiers = getActiveModifiers(modifierRules, resolvedAnimal, note, difficultyScore);

    // ---------------------------------------------------------
    // PRÉ-CALCUL PAR STAFF (le devis ne dépend pas du créneau)
    // Bug 1 fix : durée/prix évalués avec le VRAI rôle du staff.
    // Bug 2 fix : SalonRule (V2) ET ModifierRule (legacy) cumulés, un seul chemin.
    // ---------------------------------------------------------
    const staffPlans: StaffPlan[] = [];

    for (const staff of staffMembers) {
      // Gate 2 : habilitation au service
      if (!staff.allowedServiceIds.includes(serviceId)) continue;

      const staffContext: RuleContext = {
        ...baseContext,
        staff: { role: staff.role, speedIndex: staff.speedIndex },
      };

      // Une seule passe d'évaluation des SalonRules pour ce staff, puis on partitionne.
      // (Le contexte n'a pas de dimension temporelle : un BLOCK_RESOURCE est constant
      //  sur tout l'horizon, donc on l'évalue ici une fois et non par créneau.)
      const ruleEffects = evaluateRules(salonRules, staffContext);
      if (ruleEffects.some((e) => e.action === 'BLOCK_RESOURCE')) continue;

      // Modifiers legacy pontés en RuleEffect, fusionnés avec les règles V2.
      const legacyEffects: RuleEffect[] = modifiersToEffects([
        ...animalModifiers,
        ...getStaffSpecificModifiers(modifierRules, staff as any),
      ]);
      const allEffects = [...ruleEffects, ...legacyEffects];

      const durationEffects = allEffects.filter((e) => e.type === 'DURATION');
      const priceEffects = allEffects.filter((e) => e.type === 'PRICE');

      const T_theoretical = computeTheoreticalDurationV2(baseRule, durationEffects);
      const quote = buildQuoteV2(baseRule, T_theoretical, staff as any, priceEffects, salonParams, durationEffects);

      staffPlans.push({ staff, quote });
    }

    // Aucun staff ne peut réaliser ce service → pas de créneaux
    if (staffPlans.length === 0) return [];

    // ---------------------------------------------------------
    // BOUCLE JOURS / CRÉNEAUX
    // ---------------------------------------------------------
    const response: DaySlotsDto[] = [];
    const now = new Date();

    for (let dayOffset = 0; dayOffset <= horizonDays; dayOffset++) {
      const currentDay = new Date(today);
      currentDay.setDate(today.getDate() + dayOffset);
      const dayOfWeek = currentDay.getDay();

      // Gate 1: salon ouvert ce jour ?
      const dayHours = salonWorkingHours.find((wh) => wh.dayOfWeek === dayOfWeek);
      if (!dayHours) continue;

      const currentDayKey = formatDateKey(currentDay);
      const dayAppointments = appointmentsByDate.get(currentDayKey) ?? [];
      const dayManualBlocks = manualBlocksByDate.get(currentDayKey) ?? [];
      // Vue typée pour la supervision (RDV du jour + rôle du staff)
      const daySupervisionBookings: SupervisionBooking[] = dayAppointments;

      // Blocage journée complète (salon)
      const hasFullDayBlock = dayManualBlocks.some((b) => b.type === 'FULL_DAY' && b.scope === 'SALON');
      if (hasFullDayBlock) continue;

      const [openH, openM] = dayHours.startTime.split(':').map(Number);
      const [closeH, closeM] = dayHours.endTime.split(':').map(Number);

      const dayStart = new Date(currentDay);
      dayStart.setHours(openH, openM, 0, 0);

      const dayEnd = new Date(currentDay);
      dayEnd.setHours(closeH, closeM, 0, 0);

      const slotsToday: SlotDto[] = [];
      let cursor = new Date(dayStart);

      while (cursor < dayEnd) {
        if (cursor < now) {
          cursor = new Date(cursor.getTime() + granularity * 60000);
          continue;
        }

        for (const plan of staffPlans) {
          const staff = plan.staff;
          const quote = plan.quote;

          const slotStart = new Date(cursor);
          const slotEndWithBreak = new Date(cursor.getTime() + (quote.actualDurationMinutes + breakBetweenMin) * 60000);
          const slotEnd = new Date(cursor.getTime() + quote.actualDurationMinutes * 60000);

          // Gate 4: dépasse l'heure de fermeture (la pause doit tenir avant fermeture)
          if (slotEndWithBreak > dayEnd) continue;

          // Gate 3: blocage manuel (salon & staff)
          if (isBlockedByManualBlock(slotStart, slotEndWithBreak, staff.id, dayManualBlocks)) continue;

          // Gate 5: disponibilité du staff
          if (!isAvailable(staff as any, slotStart, slotEndWithBreak, dayAppointments, salonWorkingHours, absences)) continue;

          // Gate 6: capacité tables
          if (!hasCapacity(resolvedAnimal.category, slotStart, slotEndWithBreak, dayAppointments, groomingTables)) continue;

          // Gate 7: supervision — apprenti exige un pro libre pour l'encadrer
          if (!hasSupervisionCapacity(
            staff.role,
            slotStart,
            slotEndWithBreak,
            staffMembers as any,
            daySupervisionBookings,
            salonWorkingHours,
            absences,
            supervisionConfig,
          )) continue;

          // Gate 7b: supervision — bloque un pro si des apprentis ont besoin de lui
          if (isSupervisorBlockedByApprentices(
            staff.id,
            staff.role,
            slotStart,
            slotEndWithBreak,
            staffMembers as any,
            daySupervisionBookings,
            salonWorkingHours,
            absences,
            supervisionConfig,
          )) continue;

          slotsToday.push({ start: slotStart, end: slotEnd, staffId: staff.id, quote });
        }

        cursor = new Date(cursor.getTime() + granularity * 60000);
      }

      if (slotsToday.length > 0) {
        response.push({
          date: `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`,
          slots: slotsToday,
        });
      }
    }

    return response;
  }
}

function isBlockedByManualBlock(
  start: Date,
  end: Date,
  staffId: string,
  dayManualBlocks: any[],
): boolean {
  const toMins = (h: number, m: number) => h * 60 + m;
  const slotStartMins = start.getHours() * 60 + start.getMinutes();
  const slotEndMins = end.getHours() * 60 + end.getMinutes();
  const NOON_MINS = 13 * 60; // frontière matin / après-midi

  return dayManualBlocks.some((b) => {
    // 1. Scope : salon, ou ce staff précis
    if (b.scope === 'STAFF' && b.targetStaffId !== staffId) {
      return false;
    }

    // 2. Chevauchement selon le type
    if (b.type === 'FULL_DAY') {
      return true;
    }

    if (b.type === 'HALF_DAY') {
      const half = b.halfDay?.toUpperCase();
      // Chevauchement réel avec la demi-journée (pas le centre du créneau).
      if (half === 'MORNING') {
        return slotStartMins < NOON_MINS; // le créneau déborde sur le matin
      } else if (half === 'AFTERNOON') {
        return slotEndMins > NOON_MINS; // le créneau déborde sur l'après-midi
      }
    }

    if (b.type === 'TIME_RANGE') {
      if (b.startTime && b.endTime) {
        const [bStartH, bStartM] = b.startTime.split(':').map(Number);
        const [bEndH, bEndM] = b.endTime.split(':').map(Number);
        const blockStartMins = toMins(bStartH, bStartM);
        const blockEndMins = toMins(bEndH, bEndM);
        return slotStartMins < blockEndMins && slotEndMins > blockStartMins;
      }
    }

    return false;
  });
}
