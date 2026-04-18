import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RulesService {
  constructor(private prisma: PrismaService) {}

  private async resolveSalonId(salonIdOrUserId: string): Promise<string> {
    // The controller passes `req.user.user_metadata.salonId || req.user.sub`
    // but req.user is a Prisma User object without user_metadata.
    // We check if the given id is a providerProfile id first, else look it up as userId.
    const directProfile = await this.prisma.providerProfile.findUnique({ where: { id: salonIdOrUserId } });
    if (directProfile) return directProfile.id;

    const profile = await this.prisma.providerProfile.findUnique({ where: { userId: salonIdOrUserId } });
    if (!profile) throw new ForbiddenException('Profil prestataire requis');
    return profile.id;
  }

  async createBaseRule(salonId: string, data: any) {
    const resolvedSalonId = await this.resolveSalonId(salonId);
    return this.prisma.baseRule.create({
      data: {
        ...data,
        salonId: resolvedSalonId,
      },
    });
  }

  async findBaseRulesForService(salonId: string, serviceId: string) {
    const resolvedSalonId = await this.resolveSalonId(salonId);
    return this.prisma.baseRule.findMany({
      where: { salonId: resolvedSalonId, serviceId },
      orderBy: { minWeightKg: 'asc' },
    });
  }

  async updateBaseRule(salonId: string, id: string, data: any) {
    const resolvedSalonId = await this.resolveSalonId(salonId);
    const existing = await this.prisma.baseRule.findFirst({ where: { id, salonId: resolvedSalonId } });
    if (!existing) throw new NotFoundException('BaseRule not found');
    return this.prisma.baseRule.update({ where: { id }, data });
  }

  async deleteBaseRule(salonId: string, id: string) {
    const resolvedSalonId = await this.resolveSalonId(salonId);
    const existing = await this.prisma.baseRule.findFirst({ where: { id, salonId: resolvedSalonId } });
    if (!existing) throw new NotFoundException('BaseRule not found');
    return this.prisma.baseRule.delete({ where: { id } });
  }

  async createModifierRule(salonId: string, data: any) {
    const resolvedSalonId = await this.resolveSalonId(salonId);
    return this.prisma.modifierRule.create({
      data: {
        ...data,
        salonId: resolvedSalonId,
      },
    });
  }

  async findModifierRules(salonId: string) {
    const resolvedSalonId = await this.resolveSalonId(salonId);
    return this.prisma.modifierRule.findMany({
      where: { salonId: resolvedSalonId },
      orderBy: { triggerType: 'asc' },
    });
  }

  async updateModifierRule(salonId: string, id: string, data: any) {
    const resolvedSalonId = await this.resolveSalonId(salonId);
    const existing = await this.prisma.modifierRule.findFirst({ where: { id, salonId: resolvedSalonId } });
    if (!existing) throw new NotFoundException('ModifierRule not found');
    return this.prisma.modifierRule.update({ where: { id }, data });
  }
}
