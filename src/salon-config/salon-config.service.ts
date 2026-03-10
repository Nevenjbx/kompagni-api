import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSalonConfigDto } from './dto/salon-config.dto';

@Injectable()
export class SalonConfigService {
  constructor(private prisma: PrismaService) {}

  private async getSalonId(userId: string): Promise<string> {
    const profile = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('Profil prestataire requis');
    return profile.id;
  }

  async get(userId: string) {
    const salonId = await this.getSalonId(userId);

    // Upsert : crée la config si elle n'existe pas encore
    return this.prisma.salonConfig.upsert({
      where: { salonId },
      update: {},
      create: { salonId },
    });
  }

  async update(userId: string, dto: UpdateSalonConfigDto) {
    const salonId = await this.getSalonId(userId);

    // Upsert : crée si nécessaire puis applique les changements
    return this.prisma.salonConfig.upsert({
      where: { salonId },
      update: dto,
      create: { salonId, ...dto },
    });
  }

  /** Vérifie si le mode Formation est disponible (≥1 PRO + ≥1 APPRENTI) */
  async isFormationAvailable(salonId: string): Promise<boolean> {
    const staff = await this.prisma.staffMember.findMany({ where: { salonId } });
    const hasPro = staff.some((s) => s.role === 'PRO');
    const hasApprenti = staff.some((s) => s.role === 'APPRENTI');
    return hasPro && hasApprenti;
  }
}
