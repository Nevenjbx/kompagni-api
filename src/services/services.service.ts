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

  /**
   * Retourne les prestations compatibles avec un animal donné.
   * Filtre par type (DOG/CAT) et calcule le prix selon le poids.
   */
  async findForAnimal(salonId: string, animalId: string) {
    const animal = await this.prisma.pet.findUnique({ where: { id: animalId } });
    if (!animal) throw new NotFoundException('Animal non trouvé');

    const services = await this.prisma.service.findMany({
      where: { providerId: salonId, animalType: animal.type },
    });

    // Vérifier si la Formation est disponible pour ce salon
    const staff = await this.prisma.staffMember.findMany({ where: { salonId } });
    const formationAvailable = staff.some((s) => s.role === 'PRO') && staff.some((s) => s.role === 'APPRENTI');

    return services
      .map((service) => {
        // Calculer le prix pour cet animal
        const tiers = service.priceTiers as any[];
        const price = this.getPriceForWeight(tiers, animal.weightKg);
        if (price === null) return null; // Aucune tranche compatible

        // Filtrer les modes disponibles
        const modes = (service.availableModes as string[]).filter((mode) => {
          if (mode === 'FORMATION' && !formationAvailable) return false;
          return true;
        });
        if (modes.length === 0) return null;

        return { ...service, price, availableModes: modes };
      })
      .filter(Boolean);
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

  // ─── HELPERS ────────────────────────────────────

  private getPriceForWeight(tiers: any[], weightKg: number | null): number | null {
    if (!Array.isArray(tiers) || tiers.length === 0) return null;
    if (weightKg === null) {
      // Si pas de poids, retourner le prix de la dernière tranche
      return tiers[tiers.length - 1]?.price ?? null;
    }

    // Trier par maxWeightKg croissant (null = infini, toujours en dernier)
    const sorted = [...tiers].sort((a, b) => {
      if (a.maxWeightKg === null) return 1;
      if (b.maxWeightKg === null) return -1;
      return a.maxWeightKg - b.maxWeightKg;
    });

    for (const tier of sorted) {
      if (tier.maxWeightKg === null || weightKg <= tier.maxWeightKg) {
        return tier.price;
      }
    }
    return sorted[sorted.length - 1]?.price ?? null;
  }
}
