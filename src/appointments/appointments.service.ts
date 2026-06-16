import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KairosEngineService } from '../kairos/kairos-engine.service';
import { LockManagerService } from '../kairos/lock-manager.service';
import { AnimalData, LockExpiredException } from '../engine/types';
import {
  CreateAppointmentDto,
  UpdateAppointmentStatusDto,
  GetSlotsDto,
  LockSlotDto,
  CreateManualAppointmentDto,
} from './dto/appointment.dto';
import { Prisma } from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import dayjs from 'dayjs';
import { randomUUID } from 'crypto';
import { findBaseRule, computeTheoreticalDuration, buildQuote } from '../engine/duration-engine';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private prisma: PrismaService,
    private kairosEngine: KairosEngineService,
    private lockManager: LockManagerService,
  ) {}

  // ─── SLOTS ──────────────────────────────────────

  async getAvailableSlots(clientId: string, salonId: string, dto: GetSlotsDto) {
    const pet = await this.prisma.pet.findUnique({ where: { id: dto.animalId } });
    if (!pet) throw new NotFoundException('Animal non trouvé');

    const animal: AnimalData = {
      id: pet.id,
      species: pet.species,
      weightKg: pet.weightKg,
      birthDate: pet.birthDate,
      isNeutered: pet.isNeutered,
      category: pet.category as any, // casting to model enum
      coatType: pet.coatType as any,
      groomingBehavior: pet.groomingBehavior as any,
      skinCondition: pet.skinCondition as any,
      lastGroomedAt: pet.lastGroomedAt,
    };

    return this.kairosEngine.generate({
      clientId,
      salonId,
      serviceId: dto.serviceId,
      animal,
    });
  }

  async lockSlot(clientId: string, dto: LockSlotDto) {
    return this.lockManager.acquireLock({
      clientId,
      salonId: dto.salonId,
      staffId: dto.staffId,
      serviceId: dto.serviceId,
      startTime: new Date(dto.startTime),
    });
  }

  async unlockSlot(lockToken: string) {
    await this.lockManager.releaseLock(lockToken);
    return { success: true };
  }

  // ─── CREATION RDV ───────────────────────────────

  async create(clientId: string, salonId: string, dto: CreateAppointmentDto) {
    // 1. Vérifier que l'animal appartient au client
    const pet = await this.prisma.pet.findUnique({ where: { id: dto.animalId } });
    if (!pet || pet.ownerId !== clientId) {
      throw new ForbiddenException('Cet animal ne vous appartient pas');
    }

    try {
      // 2. Confirmer via LockManager
      const appointment = await this.lockManager.confirmBooking({
        clientId: clientId,
        salonId: salonId,
        serviceId: dto.serviceId,
        petId: dto.animalId,
        staffId: dto.staffId,
        slotStart: new Date(dto.slotStart),
        quoteResult: dto.quoteResult,
        hasKnotsToday: dto.hasKnotsToday,
        precautions: dto.precautions,
        clientFreeNote: dto.clientFreeNote,
        lockToken: dto.lockToken,
      });

      // 3. Inscrire le client et l'animal dans le répertoire du salon
      await Promise.all([
        this.prisma.salonClient.upsert({
          where: { salonId_clientId: { salonId, clientId } },
          update: {},
          create: { salonId, clientId }
        }),
        this.prisma.salonPet.upsert({
          where: { salonId_petId: { salonId, petId: dto.animalId } },
          update: {},
          create: { salonId, petId: dto.animalId }
        })
      ]);

      return appointment;
    } catch (error) {
      if (error instanceof LockExpiredException) {
        throw new BadRequestException({
          message: error.message,
          // We can optionally return next available if we implement a retry here.
        });
      }
      throw error;
    }
  }

  async createManual(userId: string, salonId: string, dto: CreateManualAppointmentDto) {
    const profile = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!profile || profile.id !== salonId) {
      throw new ForbiddenException('Non autorisé à ajouter un rendez-vous dans ce salon');
    }

    let resolvedClientId = dto.clientId;
    if (!resolvedClientId) {
      const uniqueEmail = dto.clientEmail || `manual_${randomUUID()}@kompagni.manual`;
      const existingUser = await this.prisma.user.findUnique({ where: { email: uniqueEmail } });
      if (existingUser) {
        resolvedClientId = existingUser.id;
      } else {
        const newUser = await this.prisma.user.create({
          data: {
            email: uniqueEmail,
            firstName: dto.clientFirstName || 'Client',
            lastName: dto.clientLastName || 'Manuel',
            phoneNumber: dto.clientPhoneNumber,
            role: 'CLIENT',
          }
        });
        resolvedClientId = newUser.id;
      }
    }

    let resolvedPetId = dto.petId;
    if (!resolvedPetId) {
      const newPet = await this.prisma.pet.create({
        data: {
          ownerId: resolvedClientId,
          name: dto.petName || 'Animal Manuel',
          category: (dto.petCategory || 'SMALL') as any,
          species: 'CHIEN',
          sex: 'UNKNOWN',
          birthDate: new Date(),
          breedId: 'UNKNOWN',
          coatType: 'NORMAL',
          groomingBehavior: 'EASY',
          skinCondition: 'NORMAL',
          weightKg: 10.0,
        }
      });
      resolvedPetId = newPet.id;
    }

    await Promise.all([
      this.prisma.salonClient.upsert({
        where: { salonId_clientId: { salonId, clientId: resolvedClientId } },
        update: {},
        create: { salonId, clientId: resolvedClientId }
      }),
      this.prisma.salonPet.upsert({
        where: { salonId_petId: { salonId, petId: resolvedPetId } },
        update: {},
        create: { salonId, petId: resolvedPetId }
      })
    ]);

    const start = new Date(dto.slotStart);
    const end = new Date(dto.slotEnd);
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

    let price = dto.manualPrice;
    if (price === undefined || price === null) {
      try {
        const pet = await this.prisma.pet.findUnique({ where: { id: resolvedPetId } });
        const baseRules = await this.prisma.baseRule.findMany({ where: { salonId, serviceId: dto.serviceId } });
        const modifierRules = await this.prisma.modifierRule.findMany({ where: { salonId, isActive: true } });
        const staff = await this.prisma.staffMember.findUnique({ where: { id: dto.staffId } });
        const salonConfig = await this.prisma.salonConfig.findUnique({ where: { salonId } });

        if (pet && baseRules.length > 0 && staff) {
          const rule = findBaseRule(baseRules, dto.serviceId, pet.weightKg);
          const activeMods = modifierRules.filter(m => {
            if (m.triggerType === 'KNOTS' && dto.petNotes?.toLowerCase().includes('nœud')) return true;
            return false;
          });
          const theoretical = computeTheoreticalDuration(rule, activeMods);
          
          const quote = buildQuote(
            rule,
            theoretical,
            staff,
            [],
            activeMods,
            salonConfig ? {
              transitionBufferMin: salonConfig.transitionBufferMin,
              clientDurationMarginPercent: salonConfig.clientDurationMarginPercent
            } : undefined
          );
          price = quote.estimatedPrice;
        } else {
          price = 50.0;
        }
      } catch (err) {
        price = 50.0;
      }
    }

    return this.prisma.appointment.create({
      data: {
        clientId: resolvedClientId,
        salonId,
        serviceId: dto.serviceId,
        petId: resolvedPetId,
        staffId: dto.staffId,
        slotStart: start,
        slotEnd: end,
        theoreticalDurationMinutes: durationMinutes,
        actualDurationMinutes: durationMinutes,
        clientDurationMax: durationMinutes,
        tableDurationMinutes: durationMinutes,
        estimatedPrice: price,
        priceDisplayMode: 'exact',
        isManual: true,
        status: 'CONFIRMED',
        hasKnotsToday: false,
        precautions: dto.petNotes,
      },
      include: {
        service: true,
        client: true,
        pet: true,
        staff: true
      }
    });
  }

  // ─── LECTURE ─────────────────────────────────────

  async findAllForClient(clientId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { clientId },
        select: {
          id: true,
          clientId: true,
          serviceId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          petId: true,
          actualDurationMinutes: true,
          appliedModifiers: true,
          clientDurationMax: true,
          clientFreeNote: true,
          confirmedAt: true,
          estimatedPrice: true,
          expiresAt: true,
          hasKnotsToday: true,
          internalNotes: true,
          lockExpiresAt: true,
          lockToken: true,
          isManual: true,
          precautions: true,
          priceDisplayDisclaimer: true,
          priceDisplayMode: true,
          rejectionReason: true,
          salonId: true,
          slotEnd: true,
          slotStart: true,
          staffId: true,
          tableDurationMinutes: true,
          theoreticalDurationMinutes: true,
          service: { select: { id: true, name: true } },
          salon: { select: { id: true, businessName: true, address: true, city: true, postalCode: true, latitude: true, longitude: true } },
          pet: { select: { id: true, ownerId: true, name: true, species: true, breedId: true, birthDate: true, isNeutered: true, sex: true, weightKg: true, category: true, coatType: true, groomingBehavior: true, skinCondition: true } },
          staff: { select: { id: true, name: true } },
        },
        orderBy: { slotStart: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.appointment.count({ where: { clientId } }),
    ]);
    return { items, total, page, limit };
  }

  async findAllForSalon(userId: string, page = 1, limit = 50) {
    const profile = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('Profil prestataire requis');

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { salonId: profile.id },
        select: {
          id: true,
          clientId: true,
          serviceId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          petId: true,
          actualDurationMinutes: true,
          appliedModifiers: true,
          clientDurationMax: true,
          clientFreeNote: true,
          confirmedAt: true,
          estimatedPrice: true,
          expiresAt: true,
          hasKnotsToday: true,
          internalNotes: true,
          lockExpiresAt: true,
          lockToken: true,
          isManual: true,
          precautions: true,
          priceDisplayDisclaimer: true,
          priceDisplayMode: true,
          rejectionReason: true,
          salonId: true,
          slotEnd: true,
          slotStart: true,
          staffId: true,
          tableDurationMinutes: true,
          theoreticalDurationMinutes: true,
          service: { select: { id: true, name: true, animalTypes: true } },
          client: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
          pet: { select: { id: true, ownerId: true, name: true, species: true, breedId: true, birthDate: true, isNeutered: true, sex: true, weightKg: true, category: true, coatType: true, groomingBehavior: true, skinCondition: true } },
          staff: { select: { id: true, name: true } },
        },
        orderBy: { slotStart: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.appointment.count({ where: { salonId: profile.id } }),
    ]);
    return { items, total, page, limit };
  }

  async findPending(userId: string) {
    const profile = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('Profil prestataire requis');

    return this.prisma.appointment.findMany({
      where: { salonId: profile.id, status: 'PENDING' },
      select: {
        id: true,
        clientId: true,
        serviceId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        petId: true,
        actualDurationMinutes: true,
        appliedModifiers: true,
        clientDurationMax: true,
        clientFreeNote: true,
        confirmedAt: true,
        estimatedPrice: true,
        expiresAt: true,
        hasKnotsToday: true,
        internalNotes: true,
        lockExpiresAt: true,
        lockToken: true,
        isManual: true,
        precautions: true,
        priceDisplayDisclaimer: true,
        priceDisplayMode: true,
        rejectionReason: true,
        salonId: true,
        slotEnd: true,
        slotStart: true,
        staffId: true,
        tableDurationMinutes: true,
        theoreticalDurationMinutes: true,
        service: { select: { id: true, name: true, animalTypes: true } },
        client: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
        pet: { select: { id: true, ownerId: true, name: true, species: true, breedId: true, birthDate: true, isNeutered: true, sex: true, weightKg: true, category: true, coatType: true, groomingBehavior: true, skinCondition: true } },
        staff: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const apt = await this.prisma.appointment.findUnique({
      where: { id },
      include: { service: true, salon: true, client: true, pet: true, staff: true },
    });
    if (!apt) throw new NotFoundException('RDV non trouvé');
    return apt;
  }

  async findOneSecured(userId: string, userRole: string, id: string) {
    const apt = await this.findOne(id);

    if (userRole === 'ADMIN') {
      return apt;
    }

    if (userRole === 'CLIENT' && apt.clientId !== userId) {
      throw new ForbiddenException('Accès non autorisé à ce rendez-vous');
    }

    if (userRole === 'PROVIDER') {
      const profile = await this.prisma.providerProfile.findUnique({ where: { userId } });
      if (!profile || apt.salonId !== profile.id) {
        throw new ForbiddenException('Accès non autorisé à ce rendez-vous');
      }
    }

    return apt;
  }

  // ─── MISE À JOUR STATUT ─────────────────────────

  async updateStatus(userId: string, appointmentId: string, dto: UpdateAppointmentStatusDto) {
    const appointment = await this.findOne(appointmentId);

    const isClient = appointment.clientId === userId;
    const profile = await this.prisma.providerProfile.findUnique({ where: { userId } });
    const isProvider = profile?.id === appointment.salonId;

    if (!isClient && !isProvider) {
      throw new ForbiddenException('Non autorisé');
    }

    // Règles de transition
    if (isClient) {
      if (dto.status !== 'CANCELLED') {
        throw new ForbiddenException('Le client ne peut qu\'annuler');
      }
      // Vérifier le délai d'annulation
      const config = await this.prisma.salonConfig.findFirst({ where: { salonId: appointment.salonId } });
      const deadline = config?.cancelDeadlineHours ?? 24;
      const hoursBeforeAppt = dayjs(appointment.slotStart).diff(dayjs(), 'hour');
      if (hoursBeforeAppt < deadline) {
        throw new BadRequestException(
          `Annulation impossible moins de ${deadline}h avant le RDV. Contactez le salon.`,
        );
      }
    }

    const data: any = { status: dto.status };
    if (dto.status === 'CONFIRMED') data.confirmedAt = new Date();
    if (dto.status === 'REJECTED') data.rejectionReason = dto.rejectionReason;

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data,
      include: { service: true, salon: true, pet: true, staff: true },
    });
  }

  // ─── EXPIRATION AUTO ────────────────────────────

  @Cron('*/10 * * * *') // S'exécute toutes les 10 minutes
  async expirePendingAppointments() {
    this.logger.log('[Cron] Vérification des rendez-vous en attente expirés...');
    const expired = await this.prisma.appointment.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'CANCELLED',
        rejectionReason: 'Expiré : Le salon n\'a pas validé la demande dans le délai de 24h.',
      },
    });
    if (expired.count > 0) {
      this.logger.log(`[Cron] Expiration automatique réussie : ${expired.count} rendez-vous expirés ont été annulés.`);
    }
    return { expiredCount: expired.count };
  }

  // ─── STATISTIQUES ──────────────────────────────

  async getStats(userId: string, period: 'today' | 'week' | 'month') {
    const profile = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('Profil prestataire requis');

    const salonId = profile.id;
    const now = dayjs();
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'today':
        startDate = now.startOf('day').toDate();
        endDate = now.endOf('day').toDate();
        break;
      case 'week':
        startDate = now.startOf('week').toDate();
        endDate = now.endOf('week').toDate();
        break;
      case 'month':
        startDate = now.startOf('month').toDate();
        endDate = now.endOf('month').toDate();
        break;
    }

    const dateFilter = { salonId, slotStart: { gte: startDate, lte: endDate } };

    const [
      totalAppointments,
      statusCounts,
      revenueResult,
      dailyCounts,
      serviceCounts,
      staffCounts,
    ] = await Promise.all([
      // 1. Total RDV
      this.prisma.appointment.count({ where: dateFilter }),

      // 2. Comptage par statut
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: dateFilter,
        _count: { id: true },
      }),

      // 3. CA (COMPLETED + CONFIRMED)
      this.prisma.appointment.aggregate({
        where: {
          ...dateFilter,
          status: { in: ['COMPLETED', 'CONFIRMED'] },
        },
        _sum: { estimatedPrice: true },
      }),

      // 4. Comptage par jour (raw query pour tronquer au jour)
      this.prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
        SELECT DATE("slotStart") as day, COUNT(*)::bigint as count
        FROM appointments
        WHERE "salonId" = ${salonId}
          AND "slotStart" >= ${startDate}
          AND "slotStart" <= ${endDate}
        GROUP BY DATE("slotStart")
        ORDER BY day ASC
      `,

      // 5. Comptage par service
      this.prisma.appointment.groupBy({
        by: ['serviceId'],
        where: dateFilter,
        _count: { id: true },
      }),

      // 6. Comptage par collaborateur
      this.prisma.appointment.groupBy({
        by: ['staffId'],
        where: dateFilter,
        _count: { id: true },
      }),
    ]);

    // Résoudre les noms de services
    const serviceIds = serviceCounts.map((s) => s.serviceId);
    const services = serviceIds.length > 0
      ? await this.prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true },
        })
      : [];
    const serviceMap = new Map(services.map((s) => [s.id, s.name]));

    // Résoudre les noms de collaborateurs
    const staffIds = staffCounts.map((s) => s.staffId);
    const staffMembers = staffIds.length > 0
      ? await this.prisma.staffMember.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, name: true },
        })
      : [];
    const staffMap = new Map(staffMembers.map((s) => [s.id, s.name]));

    // Extraire les comptages par statut
    const getStatusCount = (status: string) =>
      statusCounts.find((s) => s.status === status)?._count?.id ?? 0;

    const completedAppointments = getStatusCount('COMPLETED');
    const cancelledAppointments = getStatusCount('CANCELLED');
    const noShowAppointments = getStatusCount('NO_SHOW');
    const cancellationRate = totalAppointments > 0
      ? Math.round((cancelledAppointments / totalAppointments) * 10000) / 100
      : 0;

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      cancellationRate,
      revenue: revenueResult._sum.estimatedPrice ?? 0,
      appointmentsByDay: dailyCounts.map((d) => ({
        date: dayjs(d.day).format('YYYY-MM-DD'),
        count: Number(d.count),
      })),
      appointmentsByService: serviceCounts.map((s) => ({
        serviceId: s.serviceId,
        serviceName: serviceMap.get(s.serviceId) ?? 'Service inconnu',
        count: s._count.id,
      })),
      appointmentsByStaff: staffCounts.map((s) => ({
        staffId: s.staffId,
        staffName: staffMap.get(s.staffId) ?? 'Collaborateur inconnu',
        count: s._count.id,
      })),
    };
  }
}
