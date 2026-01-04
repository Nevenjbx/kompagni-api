import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProviderDto,
  UpdateProviderDto,
  WorkingHoursDto,
} from './dto/provider.dto';
import { ProviderProfile } from '@prisma/client';

@Injectable()
export class ProvidersService {
  constructor(private prisma: PrismaService) { }

  async create(
    userId: string,
    dto: CreateProviderDto,
  ): Promise<ProviderProfile> {
    // Check if user already has a profile
    const existing = await this.prisma.providerProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new Error('User already has a provider profile');
    }

    return this.prisma.providerProfile.create({
      data: {
        userId,
        ...dto,
      },
    });
  }

  async findOne(userId: string): Promise<ProviderProfile> {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      include: {
        services: true,
        workingHours: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('Provider profile not found');
    }

    return profile;
  }

  async updateWorkingHours(userId: string, hours: WorkingHoursDto[]) {
    const profile = await this.findOne(userId);

    // Transaction: Delete existing hours for this provider and insert new ones
    return this.prisma.$transaction(async (tx) => {
      await tx.workingHours.deleteMany({
        where: { providerId: profile.id },
      });

      if (hours.length > 0) {
        await tx.workingHours.createMany({
          data: hours.map((h) => ({
            providerId: profile.id,
            ...h,
          })),
        });
      }

      return tx.workingHours.findMany({
        where: { providerId: profile.id },
      });
    });
  }

  async update(
    userId: string,
    dto: UpdateProviderDto,
  ): Promise<ProviderProfile> {
    try {
      return await this.prisma.providerProfile.update({
        where: { userId },
        data: dto,
      });
    } catch {
      throw new NotFoundException('Provider profile not found');
    }
  }

  async search(dto: import('./dto/search.dto').SearchProviderDto) {
    const { q, animalType } = dto;
    const where: import('@prisma/client').Prisma.ProviderProfileWhereInput = {};

    if (q) {
      where.OR = [
        { businessName: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { postalCode: { contains: q } },
        {
          services: {
            some: {
              name: { contains: q, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    if (animalType) {
      if (where.services) {
        // If we already have a services filter (from 'q'), we need strict AND logic carefully
        // But Prisma 'some' is separate. simpler to just add to the AND implicit in 'where' if possible
        // structure for where.services needs to be compatible.
        // Actually, where.services is a ProviderProfileWhereInput['services'] which triggers 'some', 'every' etc.
        // We can't easily merge two 'some' clauses into one generic 'where.services' key if we want AND.
        // However, user usually wants "matches text" AND "supports animalType".
        // Let's use AND operator for complex conditions if needed.
        where.AND = [
          {
            services: {
              some: {
                animalType: animalType as any,
              }
            }
          }
        ];
      } else {
        where.services = {
          some: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            animalType: animalType as any, // Cast to AnimalType enum if needed
          },
        };
      }
    }

    // Simplify: The previous logic for animalType was:
    // where.services = { some: { animalType } }
    // If I just set where.services again, it might overwrite the OR check for services?
    // The OR above is inside `where.OR`. The animalType check should be an AND.
    // So if q is present, we have ORs. If animalType is present, we enforce it.
    // Prisma matches `where` properties as AND.
    // So `where.OR = [...]` AND `where.services = ...`
    // This works fine: "Match any of these text fields" AND "Have a service for this animal".

    // BUT wait, my previous edit added `services` to the OR list.
    // { services: { some: { name: contains q } } }
    // AND
    // { services: { some: { animalType: type } } }
    // This means: (Name matches OR Desc matches OR ServiceName matches) AND (Has AnimalType service)
    // This is correct behavior.

    return this.prisma.providerProfile.findMany({
      where,
      include: { services: true },
    });
  }
}
