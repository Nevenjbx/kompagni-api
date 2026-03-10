import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SlotEngineService } from './slot-engine.service';
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
    private slotEngine: SlotEngineService,
  ) {}

  // ─── SLOTS ──────────────────────────────────────

  async getAvailableSlots(salonId: string, dto: GetSlotsDto) {
    return this.slotEngine.generateSlots({
      salonId,
      serviceId: dto.serviceId,
      animalId: dto.animalId,
      offerType: dto.offerType,
    });
  }

  async lockSlot(dto: LockSlotDto) {
    return this.slotEngine.acquireLock(dto.slotKey);
  }

  // ─── CREATION RDV ───────────────────────────────

  async create(clientId: string, salonId: string, dto: CreateAppointmentDto) {
    // 1. Valider le verrou
    const lockValid = await this.slotEngine.validateLock(dto.lockToken);
    if (!lockValid) {
      // Proposer le prochain créneau
      const next = await this.slotEngine.findNextAvailable(
        { salonId, serviceId: dto.serviceId, animalId: dto.animalId, offerType: dto.offerType },
        new Date(dto.slotStart),
      );
      throw new BadRequestException({
        message: 'Verrou expiré ou invalide. Le créneau a peut-être été pris.',
        nextAvailable: next,
      });
    }

    // 2. Vérifier que l'animal appartient au client
    const pet = await this.prisma.pet.findUnique({ where: { id: dto.animalId } });
    if (!pet || pet.ownerId !== clientId) {
      throw new ForbiddenException('Cet animal ne vous appartient pas');
    }

    // 3. Déterminer le mode de validation
    const config = await this.prisma.salonConfig.findFirst({ where: { salonId } });
    const isAutoConfirm = config?.validationMode === 'AUTO';

    // 4. Créer le RDV
    try {
      const appointment = await this.prisma.$transaction(async (tx) => {
        // Double-check pas de conflit
        const overlap = await tx.appointment.findFirst({
          where: {
            salonId,
            tableId: dto.tableId,
            status: { notIn: ['CANCELLED', 'REJECTED', 'NO_SHOW'] },
            slotStart: { lt: new Date(dto.slotEnd) },
            slotEnd: { gt: new Date(dto.slotStart) },
          },
        });

        if (overlap) {
          throw new BadRequestException('Ce créneau vient d\'être pris');
        }

        return tx.appointment.create({
          data: {
            clientId,
            salonId,
            serviceId: dto.serviceId,
            petId: dto.animalId,
            tableId: dto.tableId,
            staffId: dto.staffId,
            offerType: dto.offerType,
            slotStart: new Date(dto.slotStart),
            slotEnd: new Date(dto.slotEnd),
            formationBlock: dto.formationBlock,
            durationMinutes: dto.durationMinutes ?? dayjs(dto.slotEnd).diff(dayjs(dto.slotStart), 'minute'),
            status: isAutoConfirm ? 'CONFIRMED' : 'PENDING',
            confirmedAt: isAutoConfirm ? new Date() : null,
            expiresAt: !isAutoConfirm
              ? dayjs().add(config?.pendingExpiryHours ?? 24, 'hour').toDate()
              : null,
            notes: dto.notes,
          },
          include: { service: true, salon: true, pet: true, staff: true, table: true },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      // 5. Libérer le verrou
      await this.slotEngine.releaseLock(dto.lockToken);

      return appointment;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new BadRequestException('Ce créneau vient d\'être réservé. Veuillez réessayer.');
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
        include: { service: true, salon: true, pet: true, staff: true, table: true },
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
        include: { service: true, client: true, pet: true, staff: true, table: true },
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
      include: { service: true, client: true, pet: true, staff: true, table: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const apt = await this.prisma.appointment.findUnique({
      where: { id },
      include: { service: true, salon: true, client: true, pet: true, staff: true, table: true },
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
      include: { service: true, salon: true, pet: true, staff: true, table: true },
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
