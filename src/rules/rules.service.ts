import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RulesService {
  constructor(private prisma: PrismaService) {}

  async createBaseRule(salonId: string, data: any) {
    // Validate bounds or overlapping rules if necessary
    return this.prisma.baseRule.create({
      data: {
        ...data,
        salonId,
      },
    });
  }

  async findBaseRulesForService(salonId: string, serviceId: string) {
    return this.prisma.baseRule.findMany({
      where: { salonId, serviceId },
      orderBy: { minWeightKg: 'asc' },
    });
  }

  async updateBaseRule(salonId: string, id: string, data: any) {
    const existing = await this.prisma.baseRule.findFirst({ where: { id, salonId } });
    if (!existing) throw new NotFoundException('BaseRule not found');
    return this.prisma.baseRule.update({ where: { id }, data });
  }

  async deleteBaseRule(salonId: string, id: string) {
    const existing = await this.prisma.baseRule.findFirst({ where: { id, salonId } });
    if (!existing) throw new NotFoundException('BaseRule not found');
    return this.prisma.baseRule.delete({ where: { id } });
  }

  async createModifierRule(salonId: string, data: any) {
    return this.prisma.modifierRule.create({
      data: {
        ...data,
        salonId,
      },
    });
  }

  async findModifierRules(salonId: string) {
    return this.prisma.modifierRule.findMany({
      where: { salonId },
      orderBy: { triggerType: 'asc' },
    });
  }

  async updateModifierRule(salonId: string, id: string, data: any) {
    const existing = await this.prisma.modifierRule.findFirst({ where: { id, salonId } });
    if (!existing) throw new NotFoundException('ModifierRule not found');
    return this.prisma.modifierRule.update({ where: { id }, data });
  }
}
