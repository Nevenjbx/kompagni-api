import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  async create(userId: string, dto: CreateStaffDto) {
    const salonId = await this.getSalonId(userId);
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
    await this.findOne(userId, staffId); // Vérifie ownership
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
