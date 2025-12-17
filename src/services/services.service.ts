import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateServiceDto) {
    // 1. Find provider profile for this user
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new ForbiddenException(
        'You must create a provider profile before adding services',
      );
    }

    // 2. Create service linked to provider
    return this.prisma.service.create({
      data: {
        providerId: provider.id,
        ...dto,
      },
    });
  }

  async findAll(providerId?: string) {
    if (providerId) {
      return this.prisma.service.findMany({
        where: { providerId },
      });
    }
    return this.prisma.service.findMany();
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  async update(userId: string, id: string, dto: UpdateServiceDto) {
    // Check ownership
    const service = await this.findOne(id);
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
    });

    if (!provider || service.providerId !== provider.id) {
      throw new ForbiddenException(
        'You are not authorized to edit this service',
      );
    }

    return this.prisma.service.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    // Check ownership
    const service = await this.findOne(id);
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
    });

    if (!provider || service.providerId !== provider.id) {
      throw new ForbiddenException(
        'You are not authorized to delete this service',
      );
    }

    return this.prisma.service.delete({
      where: { id },
    });
  }
}
