import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalonRuleDto, UpdateSalonRuleDto } from './dto/salon-rule.dto';

@Injectable()
export class SalonRulesService {
  constructor(private prisma: PrismaService) {}

  private async resolveSalonId(salonIdOrUserId: string): Promise<string> {
    const directProfile = await this.prisma.providerProfile.findUnique({ where: { id: salonIdOrUserId } });
    if (directProfile) return directProfile.id;

    const profile = await this.prisma.providerProfile.findUnique({ where: { userId: salonIdOrUserId } });
    if (!profile) throw new ForbiddenException('Profil prestataire requis');
    return profile.id;
  }

  async findAll(salonId: string) {
    const resolvedSalonId = await this.resolveSalonId(salonId);
    return this.prisma.salonRule.findMany({
      where: { salonId: resolvedSalonId },
      orderBy: { priority: 'asc' },
    });
  }

  async findOne(salonId: string, id: string) {
    const resolvedSalonId = await this.resolveSalonId(salonId);
    const rule = await this.prisma.salonRule.findFirst({
      where: { id, salonId: resolvedSalonId },
    });
    if (!rule) throw new NotFoundException('Règle non trouvée');
    return rule;
  }

  async create(salonId: string, dto: CreateSalonRuleDto) {
    const resolvedSalonId = await this.resolveSalonId(salonId);
    
    // Default priority: append at the end
    const maxPriority = await this.prisma.salonRule.aggregate({
      where: { salonId: resolvedSalonId },
      _max: { priority: true },
    });
    const nextPriority = dto.priority ?? ((maxPriority._max.priority ?? -1) + 1);

    return this.prisma.salonRule.create({
      data: {
        ...dto,
        priority: nextPriority,
        salonId: resolvedSalonId,
      },
    });
  }

  async update(salonId: string, id: string, dto: UpdateSalonRuleDto) {
    const resolvedSalonId = await this.resolveSalonId(salonId);
    const existing = await this.prisma.salonRule.findFirst({
      where: { id, salonId: resolvedSalonId },
    });
    if (!existing) throw new NotFoundException('Règle non trouvée');

    return this.prisma.salonRule.update({
      where: { id },
      data: dto,
    });
  }

  async toggle(salonId: string, id: string) {
    const resolvedSalonId = await this.resolveSalonId(salonId);
    const existing = await this.prisma.salonRule.findFirst({
      where: { id, salonId: resolvedSalonId },
    });
    if (!existing) throw new NotFoundException('Règle non trouvée');

    return this.prisma.salonRule.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
  }

  async remove(salonId: string, id: string) {
    const resolvedSalonId = await this.resolveSalonId(salonId);
    const existing = await this.prisma.salonRule.findFirst({
      where: { id, salonId: resolvedSalonId },
    });
    if (!existing) throw new NotFoundException('Règle non trouvée');

    return this.prisma.salonRule.delete({ where: { id } });
  }

  async reorder(salonId: string, orderedIds: string[]) {
    const resolvedSalonId = await this.resolveSalonId(salonId);
    
    // Update priority for each rule based on its position in the array
    const updates = orderedIds.map((id, index) =>
      this.prisma.salonRule.updateMany({
        where: { id, salonId: resolvedSalonId },
        data: { priority: index },
      })
    );

    await this.prisma.$transaction(updates);

    return this.findAll(salonId);
  }
}
