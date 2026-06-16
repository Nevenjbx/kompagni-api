import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DirectoryService {
  private readonly logger = new Logger(DirectoryService.name);

  constructor(private prisma: PrismaService) {}

  // ─── CLIENTS LIST ─────────────────────────────────

  async getClients(salonId: string, search?: string, page = 1, limit = 20) {
    if (!salonId) throw new ForbiddenException('Profil prestataire requis');
    const skip = (page - 1) * limit;

    const baseWhere: any = {
      salonId,
      client: {
        role: 'CLIENT',
      }
    };

    if (search && search.trim()) {
      const searchTerm = search.trim();
      baseWhere.client.OR = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phoneNumber: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [salonClients, total] = await Promise.all([
      this.prisma.salonClient.findMany({
        where: baseWhere,
        select: {
          client: {
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
                  appointments: { where: { salonId } }
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
            }
          }
        },
        orderBy: [
          { client: { lastName: 'asc' } },
          { client: { firstName: 'asc' } },
        ],
        skip,
        take: limit,
      }),
      this.prisma.salonClient.count({ where: baseWhere }),
    ]);

    const items = salonClients.map(({ client }) => ({
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phoneNumber: client.phoneNumber,
      isBlocked: client.isBlocked,
      blockedReason: client.blockedReason,
      cancellationCount: client.cancellationCount,
      petCount: client._count.pets,
      totalAppointments: client._count.appointments,
      lastAppointmentDate: client.appointments[0]?.slotStart ?? null,
      lastAppointmentStatus: client.appointments[0]?.status ?? null,
    }));

    return { items, total, page, limit };
  }

  // ─── PETS LIST ────────────────────────────────────

  async getPets(salonId: string, search?: string, page = 1, limit = 20, species?: string) {
    if (!salonId) throw new ForbiddenException('Profil prestataire requis');
    const skip = (page - 1) * limit;

    const baseWhere: any = {
      salonId,
      pet: {}
    };

    if (species && species.trim()) {
      baseWhere.pet.species = { equals: species.trim(), mode: 'insensitive' };
    }

    if (search && search.trim()) {
      const searchTerm = search.trim();
      baseWhere.pet.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { owner: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
        { owner: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    if (Object.keys(baseWhere.pet).length === 0) {
      delete baseWhere.pet;
    }

    const [salonPets, total] = await Promise.all([
      this.prisma.salonPet.findMany({
        where: baseWhere,
        select: {
          pet: {
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
              _count: {
                select: {
                  appointments: { where: { salonId } }
                }
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
            }
          }
        },
        orderBy: { pet: { name: 'asc' } },
        skip,
        take: limit,
      }),
      this.prisma.salonPet.count({ where: baseWhere }),
    ]);

    const items = salonPets.map(({ pet }) => ({
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
      totalAppointments: pet._count.appointments,
      lastAppointmentDate: pet.appointments[0]?.slotStart ?? null,
    }));

    return { items, total, page, limit };
  }

  // ─── CLIENT DETAIL ────────────────────────────────

  async getClientDetail(salonId: string, clientId: string) {
    if (!salonId) throw new ForbiddenException('Profil prestataire requis');
    
    const isSalonClient = await this.prisma.salonClient.findUnique({
      where: { salonId_clientId: { salonId, clientId } }
    });

    if (!isSalonClient) {
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
      this.prisma.pet.findMany({
        where: {
          ownerId: clientId,
          salonPets: { some: { salonId } }
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
          ownerId: true,
          groomingBehavior: true,
          skinCondition: true,
          isNeutered: true,
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

  async getPetDetail(salonId: string, petId: string) {
    if (!salonId) throw new ForbiddenException('Profil prestataire requis');

    const isSalonPet = await this.prisma.salonPet.findUnique({
      where: { salonId_petId: { salonId, petId } }
    });

    if (!isSalonPet) {
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
