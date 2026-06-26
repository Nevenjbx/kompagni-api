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

    const baseWhereReal: any = {
      salonId,
      client: {
        role: 'CLIENT',
      }
    };
    
    const baseWhereInternal: any = {
      salonId,
    };

    if (search && search.trim()) {
      const searchTerm = search.trim();
      baseWhereReal.client.OR = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phoneNumber: { contains: searchTerm, mode: 'insensitive' } },
      ];
      baseWhereInternal.OR = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [salonClients, salonInternalClients] = await Promise.all([
      this.prisma.salonClient.findMany({
        where: baseWhereReal,
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
      }),
      this.prisma.salonInternalClient.findMany({
        where: baseWhereInternal,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
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
        },
      }),
    ]);

    const realItems = salonClients.map(({ client }) => ({
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
      isInternal: false,
    }));

    const internalItems = salonInternalClients.map((client) => ({
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phoneNumber: client.phone,
      isBlocked: false,
      blockedReason: null,
      cancellationCount: 0,
      petCount: client._count.pets,
      totalAppointments: client._count.appointments,
      lastAppointmentDate: client.appointments[0]?.slotStart ?? null,
      lastAppointmentStatus: client.appointments[0]?.status ?? null,
      isInternal: true,
    }));

    const merged = [...realItems, ...internalItems];
    merged.sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const total = merged.length;
    const items = merged.slice(skip, skip + limit);

    return { items, total, page, limit };
  }

  // ─── PETS LIST ────────────────────────────────────

  async getPets(salonId: string, search?: string, page = 1, limit = 20, species?: string) {
    if (!salonId) throw new ForbiddenException('Profil prestataire requis');
    const skip = (page - 1) * limit;

    const baseWhereReal: any = {
      salonId,
      pet: {}
    };
    const baseWhereInternal: any = {
      salonId,
    };

    if (species && species.trim()) {
      baseWhereReal.pet.species = { equals: species.trim(), mode: 'insensitive' };
      baseWhereInternal.species = { equals: species.trim(), mode: 'insensitive' };
    }

    if (search && search.trim()) {
      const searchTerm = search.trim();
      baseWhereReal.pet.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { owner: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
        { owner: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
      ];
      baseWhereInternal.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { client: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
        { client: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    if (Object.keys(baseWhereReal.pet).length === 0) {
      delete baseWhereReal.pet;
    }

    const [salonPets, salonInternalPets] = await Promise.all([
      this.prisma.salonPet.findMany({
        where: baseWhereReal,
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
      }),
      this.prisma.salonInternalPet.findMany({
        where: baseWhereInternal,
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
          clientId: true,
          client: {
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
        },
      }),
    ]);

    const realItems = salonPets.map(({ pet }) => ({
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
      isInternal: false,
    }));

    const internalItems = salonInternalPets.map((pet) => ({
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
      ownerId: pet.clientId,
      ownerFirstName: pet.client.firstName,
      ownerLastName: pet.client.lastName,
      ownerEmail: pet.client.email,
      totalAppointments: pet._count.appointments,
      lastAppointmentDate: pet.appointments[0]?.slotStart ?? null,
      isInternal: true,
    }));

    const merged = [...realItems, ...internalItems];
    merged.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    const total = merged.length;
    const items = merged.slice(skip, skip + limit);

    return { items, total, page, limit };
  }

  // ─── CLIENT DETAIL ────────────────────────────────

  async getClientDetail(salonId: string, clientId: string) {
    if (!salonId) throw new ForbiddenException('Profil prestataire requis');
    
    // Check if it's an internal client first
    const isInternalClient = await this.prisma.salonInternalClient.findUnique({
      where: { id: clientId }
    });

    if (isInternalClient && isInternalClient.salonId === salonId) {
      const [appointments, pets] = await Promise.all([
        this.prisma.appointment.findMany({
          where: { internalClientId: clientId, salonId },
          select: {
            id: true,
            slotStart: true,
            slotEnd: true,
            status: true,
            estimatedPrice: true,
            service: { select: { id: true, name: true } },
            internalPet: { select: { id: true, name: true, species: true } },
            staff: { select: { id: true, name: true } },
          },
          orderBy: { slotStart: 'desc' },
          take: 50,
        }),
        this.prisma.salonInternalPet.findMany({
          where: { clientId, salonId },
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
            clientId: true,
            groomingBehavior: true,
            skinCondition: true,
            isNeutered: true,
          },
        }),
      ]);

      return {
        id: isInternalClient.id,
        firstName: isInternalClient.firstName,
        lastName: isInternalClient.lastName,
        email: isInternalClient.email,
        phoneNumber: isInternalClient.phone,
        isBlocked: false,
        blockedReason: null,
        cancellationCount: 0,
        createdAt: isInternalClient.createdAt,
        isInternal: true,
        pets: pets.map(p => ({ ...p, ownerId: p.clientId })),
        appointments: appointments.map(a => ({
          ...a,
          pet: a.internalPet, // Mappé pour le front
        })),
        totalAppointments: appointments.length,
      };
    }

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
      isInternal: false,
      pets,
      appointments,
      totalAppointments: appointments.length,
    };
  }

  // ─── PET DETAIL ───────────────────────────────────

  async getPetDetail(salonId: string, petId: string) {
    if (!salonId) throw new ForbiddenException('Profil prestataire requis');

    const isInternalPet = await this.prisma.salonInternalPet.findUnique({
      where: { id: petId },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (isInternalPet && isInternalPet.salonId === salonId) {
      const appointments = await this.prisma.appointment.findMany({
        where: { internalPetId: petId, salonId },
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
      });

      return {
        id: isInternalPet.id,
        name: isInternalPet.name,
        species: isInternalPet.species,
        breedId: isInternalPet.breedId,
        category: isInternalPet.category,
        coatType: isInternalPet.coatType,
        weightKg: isInternalPet.weightKg,
        sex: isInternalPet.sex,
        birthDate: isInternalPet.birthDate,
        ownerId: isInternalPet.clientId,
        groomingBehavior: isInternalPet.groomingBehavior,
        skinCondition: isInternalPet.skinCondition,
        isNeutered: isInternalPet.isNeutered,
        owner: {
          id: isInternalPet.client.id,
          firstName: isInternalPet.client.firstName,
          lastName: isInternalPet.client.lastName,
          email: isInternalPet.client.email,
          phoneNumber: isInternalPet.client.phone,
        },
        isInternal: true,
        appointments,
        totalAppointments: appointments.length,
      };
    }

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
      isInternal: false,
      appointments,
      totalAppointments: appointments.length,
    };
  }

  async updateInternalClient(salonId: string, clientId: string, dto: any) {
    const client = await this.prisma.salonInternalClient.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client interne introuvable');
    if (client.salonId !== salonId) throw new ForbiddenException('Non autorisé');

    return this.prisma.salonInternalClient.update({
      where: { id: clientId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
      },
    });
  }

  async updateInternalPet(salonId: string, petId: string, dto: any) {
    const pet = await this.prisma.salonInternalPet.findUnique({ where: { id: petId } });
    if (!pet) throw new NotFoundException('Animal interne introuvable');
    if (pet.salonId !== salonId) throw new ForbiddenException('Non autorisé');

    return this.prisma.salonInternalPet.update({
      where: { id: petId },
      data: {
        name: dto.name,
        species: dto.species,
        breedId: dto.breedId,
        category: dto.category,
        coatType: dto.coatType,
        groomingBehavior: dto.groomingBehavior,
        skinCondition: dto.skinCondition,
        weightKg: dto.weightKg ?? null,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        sex: dto.sex,
        isNeutered: dto.isNeutered,
      },
    });
  }
}
