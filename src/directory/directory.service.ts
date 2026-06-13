import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DirectoryService {
  private readonly logger = new Logger(DirectoryService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Helpers ─────────────────────────────────────

  private async getSalonId(userId: string): Promise<string> {
    const profile = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('Profil prestataire requis');
    return profile.id;
  }

  // ─── CLIENTS LIST ─────────────────────────────────

  async getClients(userId: string, search?: string, page = 1, limit = 20) {
    const salonId = await this.getSalonId(userId);
    const skip = (page - 1) * limit;

    // Build the WHERE clause for clients who have at least one appointment in this salon
    const baseWhere: any = {
      appointments: {
        some: { salonId },
      },
      role: 'CLIENT',
    };

    // Add search filter
    if (search && search.trim()) {
      const searchTerm = search.trim();
      baseWhere.OR = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phoneNumber: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: baseWhere,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          isBlocked: true,
          blockedReason: true,
          cancellationCount: true,
          _count: {
            select: {
              pets: true,
            },
          },
          appointments: {
            where: { salonId },
            select: {
              id: true,
              slotStart: true,
              status: true,
            },
            orderBy: { slotStart: 'desc' },
            take: 1,
          },
        },
        orderBy: [
          { lastName: 'asc' },
          { firstName: 'asc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where: baseWhere }),
    ]);

    // Also count total appointments per client in this salon
    const clientIds = users.map(u => u.id);
    const appointmentCounts = clientIds.length > 0
      ? await this.prisma.appointment.groupBy({
          by: ['clientId'],
          where: { salonId, clientId: { in: clientIds } },
          _count: { id: true },
        })
      : [];

    const countMap = new Map(appointmentCounts.map(a => [a.clientId, a._count.id]));

    const items = users.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      isBlocked: user.isBlocked,
      blockedReason: user.blockedReason,
      cancellationCount: user.cancellationCount,
      petCount: user._count.pets,
      totalAppointments: countMap.get(user.id) ?? 0,
      lastAppointmentDate: user.appointments[0]?.slotStart ?? null,
      lastAppointmentStatus: user.appointments[0]?.status ?? null,
    }));

    return { items, total, page, limit };
  }

  // ─── PETS LIST ────────────────────────────────────

  async getPets(userId: string, search?: string, page = 1, limit = 20, species?: string) {
    const salonId = await this.getSalonId(userId);
    const skip = (page - 1) * limit;

    // Build WHERE clause for pets that have at least one appointment in this salon
    const baseWhere: any = {
      appointments: {
        some: { salonId },
      },
    };

    if (species && species.trim()) {
      baseWhere.species = { equals: species.trim(), mode: 'insensitive' };
    }

    if (search && search.trim()) {
      const searchTerm = search.trim();
      baseWhere.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { owner: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
        { owner: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const [pets, total] = await Promise.all([
      this.prisma.pet.findMany({
        where: baseWhere,
        select: {
          id: true,
          name: true,
          species: true,
          breedId: true,
          birthDate: true,
          sex: true,
          weightKg: true,
          category: true,
          coatType: true,
          groomingBehavior: true,
          skinCondition: true,
          isNeutered: true,
          ownerId: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          appointments: {
            where: { salonId },
            select: {
              id: true,
              slotStart: true,
              status: true,
            },
            orderBy: { slotStart: 'desc' },
            take: 1,
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.pet.count({ where: baseWhere }),
    ]);

    // Count total appointments per pet in this salon
    const petIds = pets.map(p => p.id);
    const appointmentCounts = petIds.length > 0
      ? await this.prisma.appointment.groupBy({
          by: ['petId'],
          where: { salonId, petId: { in: petIds } },
          _count: { id: true },
        })
      : [];

    const countMap = new Map(appointmentCounts.map(a => [a.petId, a._count.id]));

    const items = pets.map(pet => ({
      id: pet.id,
      name: pet.name,
      species: pet.species,
      breedId: pet.breedId,
      birthDate: pet.birthDate,
      sex: pet.sex,
      weightKg: pet.weightKg,
      category: pet.category,
      coatType: pet.coatType,
      groomingBehavior: pet.groomingBehavior,
      skinCondition: pet.skinCondition,
      isNeutered: pet.isNeutered,
      ownerId: pet.ownerId,
      ownerFirstName: pet.owner.firstName,
      ownerLastName: pet.owner.lastName,
      ownerEmail: pet.owner.email,
      totalAppointments: countMap.get(pet.id) ?? 0,
      lastAppointmentDate: pet.appointments[0]?.slotStart ?? null,
    }));

    return { items, total, page, limit };
  }

  // ─── CLIENT DETAIL ────────────────────────────────

  async getClientDetail(userId: string, clientId: string) {
    const salonId = await this.getSalonId(userId);

    // Verify this client has had appointments in this salon
    const hasAppointment = await this.prisma.appointment.findFirst({
      where: { clientId, salonId },
    });
    if (!hasAppointment) {
      throw new NotFoundException('Client non trouvé dans votre répertoire');
    }

    const [client, appointments, pets] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          isBlocked: true,
          blockedReason: true,
          cancellationCount: true,
          createdAt: true,
        },
      }),
      this.prisma.appointment.findMany({
        where: { clientId, salonId },
        select: {
          id: true,
          slotStart: true,
          slotEnd: true,
          status: true,
          estimatedPrice: true,
          service: { select: { id: true, name: true } },
          pet: { select: { id: true, name: true, species: true } },
          staff: { select: { id: true, name: true } },
        },
        orderBy: { slotStart: 'desc' },
        take: 50,
      }),
      // Get only pets that have appointments in this salon
      this.prisma.pet.findMany({
        where: {
          ownerId: clientId,
          appointments: { some: { salonId } },
        },
        select: {
          id: true,
          name: true,
          species: true,
          breedId: true,
          category: true,
          coatType: true,
          weightKg: true,
          sex: true,
          birthDate: true,
        },
      }),
    ]);

    if (!client) {
      throw new NotFoundException('Client non trouvé');
    }

    return {
      ...client,
      pets,
      appointments,
      totalAppointments: appointments.length,
    };
  }

  // ─── PET DETAIL ───────────────────────────────────

  async getPetDetail(userId: string, petId: string) {
    const salonId = await this.getSalonId(userId);

    // Verify this pet has had appointments in this salon
    const hasAppointment = await this.prisma.appointment.findFirst({
      where: { petId, salonId },
    });
    if (!hasAppointment) {
      throw new NotFoundException('Animal non trouvé dans votre répertoire');
    }

    const [pet, appointments] = await Promise.all([
      this.prisma.pet.findUnique({
        where: { id: petId },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      }),
      this.prisma.appointment.findMany({
        where: { petId, salonId },
        select: {
          id: true,
          slotStart: true,
          slotEnd: true,
          status: true,
          estimatedPrice: true,
          service: { select: { id: true, name: true } },
          staff: { select: { id: true, name: true } },
        },
        orderBy: { slotStart: 'desc' },
        take: 50,
      }),
    ]);

    if (!pet) {
      throw new NotFoundException('Animal non trouvé');
    }

    return {
      ...pet,
      appointments,
      totalAppointments: appointments.length,
    };
  }
}
