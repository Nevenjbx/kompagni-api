import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTableDto, UpdateTableDto } from './dto/table.dto';

@Injectable()
export class TablesService {
  constructor(private prisma: PrismaService) {}

  private async getSalonId(userId: string): Promise<string> {
    const profile = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('Profil prestataire requis');
    return profile.id;
  }

  async create(userId: string, dto: CreateTableDto) {
    const salonId = await this.getSalonId(userId);
    return this.prisma.groomingTable.create({
      data: { salonId, ...dto },
    });
  }

  async findAll(userId: string) {
    const salonId = await this.getSalonId(userId);
    return this.prisma.groomingTable.findMany({
      where: { salonId },
      orderBy: { name: 'asc' },
    });
  }

  async update(userId: string, tableId: string, dto: UpdateTableDto) {
    const salonId = await this.getSalonId(userId);
    const table = await this.prisma.groomingTable.findUnique({ where: { id: tableId } });
    if (!table || table.salonId !== salonId) throw new NotFoundException('Table non trouvée');
    return this.prisma.groomingTable.update({
      where: { id: tableId },
      data: dto,
    });
  }

  async remove(userId: string, tableId: string) {
    const salonId = await this.getSalonId(userId);
    const table = await this.prisma.groomingTable.findUnique({ where: { id: tableId } });
    if (!table || table.salonId !== salonId) throw new NotFoundException('Table non trouvée');
    return this.prisma.groomingTable.delete({ where: { id: tableId } });
  }
}
