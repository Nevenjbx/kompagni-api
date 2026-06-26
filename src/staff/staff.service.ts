import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  private async getSalonId(userId: string): Promise<string> {
    const profile = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('Profil prestataire requis');
    return profile.id;
  }

  private async validateCustomSchedule(salonId: string, weeklySchedule: any[]) {
    if (!Array.isArray(weeklySchedule)) return;
    
    const salonHours = await this.prisma.workingHours.findMany({ 
      where: { providerId: salonId } 
    });

    for (const entry of weeklySchedule) {
      const salonDay = salonHours.find(wh => wh.dayOfWeek === entry.dayOfWeek);
      if (!salonDay) {
        throw new BadRequestException(
          `Le salon est fermé le jour ${entry.dayOfWeek}. L'employé ne peut pas y travailler.`
        );
      }
      // Vérifier bornes : employé ⊆ salon
      if (entry.startTime < salonDay.startTime || entry.endTime > salonDay.endTime) {
        throw new BadRequestException(
          `Les horaires du jour ${entry.dayOfWeek} (${entry.startTime}-${entry.endTime}) dépassent ceux du salon (${salonDay.startTime}-${salonDay.endTime}).`
        );
      }
    }
  }

  async create(userId: string, dto: CreateStaffDto) {
    const salonId = await this.getSalonId(userId);
    if (dto.followSalonSchedule === false && dto.weeklySchedule) {
      await this.validateCustomSchedule(salonId, dto.weeklySchedule);
    }
    return this.prisma.staffMember.create({
      data: { salonId, ...dto },
    });
  }

  async findAll(userId: string) {
    const salonId = await this.getSalonId(userId);
    return this.prisma.staffMember.findMany({
      where: { salonId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(userId: string, staffId: string) {
    const salonId = await this.getSalonId(userId);
    const staff = await this.prisma.staffMember.findUnique({
      where: { id: staffId },
    });
    if (!staff || staff.salonId !== salonId) throw new NotFoundException('Staff non trouvé');
    return staff;
  }

  async update(userId: string, staffId: string, dto: UpdateStaffDto) {
    const staff = await this.findOne(userId, staffId); // Vérifie ownership
    if (dto.followSalonSchedule === false && dto.weeklySchedule) {
      await this.validateCustomSchedule(staff.salonId, dto.weeklySchedule);
    }
    return this.prisma.staffMember.update({
      where: { id: staffId },
      data: dto,
    });
  }

  async remove(userId: string, staffId: string) {
    await this.findOne(userId, staffId);
    return this.prisma.staffMember.delete({ where: { id: staffId } });
  }
}
