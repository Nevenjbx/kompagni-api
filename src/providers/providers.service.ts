import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProviderDto,
  UpdateProviderDto,
} from './dto/provider.dto';
import { CreateWorkingHoursDto } from './dto/create-working-hours.dto';
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

  async updateWorkingHours(userId: string, hours: CreateWorkingHoursDto[]) {
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
        { city: { contains: q, mode: 'insensitive' } },
        { postalCode: { contains: q } },
      ];
    }

    if (animalType) {
      where.services = {
        some: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          animalType: animalType as any, // Cast to AnimalType enum if needed
        },
      };
    }

    return this.prisma.providerProfile.findMany({
      where,
      include: { services: true },
    });
  }
}
