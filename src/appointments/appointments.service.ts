import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
} from './dto/appointment.dto';
import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private kairosEngine: KairosEngineService,
    private lockManager: LockManagerService,
  ) {}

  // ─── SLOTS ──────────────────────────────────────

  async getAvailableSlots(salonId: string, dto: GetSlotsDto) {
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
      clientId: 'guest', // Using a placeholder since getAvailableSlots doesn't take auth
      salonId,
      serviceId: dto.serviceId,
      animal,
    });
  }

  async lockSlot(dto: LockSlotDto) {
    return this.lockManager.acquireLock({
      salonId: dto.salonId,
      staffId: dto.staffId,
      serviceId: dto.serviceId,
      startTime: new Date(dto.startTime),
    });
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

  // ─── LECTURE ─────────────────────────────────────

  async findAllForClient(clientId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { clientId },
        include: { service: true, salon: true, pet: true, staff: true },
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
        include: { service: true, client: true, pet: true, staff: true },
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
      include: { service: true, client: true, pet: true, staff: true },
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

  async expirePendingAppointments() {
    const expired = await this.prisma.appointment.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'CANCELLED' },
    });
    return { expiredCount: expired.count };
  }
}
