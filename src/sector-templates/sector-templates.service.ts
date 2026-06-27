import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getSectorTemplate, getAllSectorTemplates, SectorTemplate } from './templates';

@Injectable()
export class SectorTemplatesService {
  constructor(private prisma: PrismaService) {}

  findAll(): SectorTemplate[] {
    return getAllSectorTemplates();
  }

  findOne(templateId: string): SectorTemplate {
    const template = getSectorTemplate(templateId);
    if (!template) throw new NotFoundException(`Template '${templateId}' non trouvé`);
    return template;
  }

  /**
   * Apply a sector template to a salon.
   * Creates or updates the SalonConfig with the template defaults.
   */
  async apply(userId: string, templateId: string) {
    const template = this.findOne(templateId);

    const profile = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profil prestataire non trouvé');

    // Update the sector template on the profile
    await this.prisma.providerProfile.update({
      where: { id: profile.id },
      data: { sectorTemplate: templateId },
    });

    // Create or update the SalonConfig with template defaults
    await this.prisma.salonConfig.upsert({
      where: { salonId: profile.id },
      create: {
        salonId: profile.id,
        groomingTables: template.defaults.groomingTables,
        transitionBufferMin: template.defaults.transitionBufferMin,
        clientDurationMarginPercent: template.defaults.clientDurationMarginPercent,
        breakBetweenAppointmentsMin: template.defaults.breakBetweenAppointmentsMin,
        slotGranularityMin: template.defaults.slotGranularityMin,
        planningHorizonDays: template.defaults.planningHorizonDays,
      },
      update: {
        groomingTables: template.defaults.groomingTables,
        transitionBufferMin: template.defaults.transitionBufferMin,
        clientDurationMarginPercent: template.defaults.clientDurationMarginPercent,
        breakBetweenAppointmentsMin: template.defaults.breakBetweenAppointmentsMin,
        slotGranularityMin: template.defaults.slotGranularityMin,
        planningHorizonDays: template.defaults.planningHorizonDays,
      },
    });

    return {
      message: `Template '${template.label}' appliqué avec succès`,
      template: template.id,
    };
  }
}
