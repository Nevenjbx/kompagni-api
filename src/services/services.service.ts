import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateServiceDto) {
    const provider = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!provider) throw new ForbiddenException('Profil prestataire requis');

    const { basePrice, baseDurationMinutes, ...serviceData } = dto;

    const service = await this.prisma.service.create({
      data: {
        ...serviceData,
        provider: { connect: { id: provider.id } },
      },
    });

    // Créer une règle de base par défaut (0-9999 kg) si spécifié
    if (basePrice !== undefined || baseDurationMinutes !== undefined) {
      await this.prisma.baseRule.create({
        data: {
          salonId: provider.id,
          serviceId: service.id,
          minWeightKg: 0,
          maxWeightKg: 9999,
          basePrice: basePrice ?? 0,
          baseDurationMinutes: baseDurationMinutes ?? 60,
          includedMinutes: 9999,
          overtimeRatePerMin: 0,
        },
      });
    }

    return this.findOne(service.id);
  }

  async findAll(providerId?: string) {
    if (!providerId) {
      throw new BadRequestException('Le paramètre providerId est obligatoire');
    }
    return this.prisma.service.findMany({
      where: { providerId },
      include: { baseRules: true },
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { baseRules: true },
    });
    if (!service) throw new NotFoundException('Service non trouvé');
    return service;
  }

  async findForAnimal(salonId: string, animalId: string) {
    const animal = await this.prisma.pet.findUnique({ where: { id: animalId } });
    if (!animal) throw new NotFoundException('Animal non trouvé');

    return this.prisma.service.findMany({
      where: { providerId: salonId, animalTypes: { has: animal.species } },
      include: { baseRules: true },
    });
  }

  async update(userId: string, id: string, dto: UpdateServiceDto) {
    const service = await this.findOne(id);
    const provider = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!provider || service.providerId !== provider.id) {
      throw new ForbiddenException('Non autorisé');
    }
    return this.prisma.service.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    const service = await this.findOne(id);
    const provider = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!provider || service.providerId !== provider.id) {
      throw new ForbiddenException('Non autorisé');
    }
    return this.prisma.service.delete({ where: { id } });
  }

}
