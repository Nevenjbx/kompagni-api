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
    const provider = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!provider) throw new ForbiddenException('Profil prestataire requis');

    return this.prisma.service.create({
      data: {
        ...dto,
        provider: { connect: { id: provider.id } },
      },
    });
  }

  async findAll(providerId?: string) {
    if (providerId) {
      return this.prisma.service.findMany({ where: { providerId } });
    }
    return this.prisma.service.findMany();
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException('Service non trouvé');
    return service;
  }

  async findForAnimal(salonId: string, animalId: string) {
    const animal = await this.prisma.pet.findUnique({ where: { id: animalId } });
    if (!animal) throw new NotFoundException('Animal non trouvé');

    return this.prisma.service.findMany({
      where: { providerId: salonId, animalTypes: { has: animal.species } },
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
