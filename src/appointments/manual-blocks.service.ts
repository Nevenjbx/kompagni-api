import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockType, BlockScope } from '@prisma/client';

export class CreateManualBlockDto {
  salonId: string;
  type: BlockType;
  scope: BlockScope;
  date: string; // ISO date
  halfDay?: string;
  startTime?: string;
  endTime?: string;
  targetTableId?: string;
  targetStaffId?: string;
  reason?: string;
}

@Injectable()
export class ManualBlocksService {
  constructor(private prisma: PrismaService) {}

  private async getSalonId(userId: string): Promise<string> {
    const profile = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('Profil prestataire requis');
    return profile.id;
  }

  async create(userId: string, dto: Omit<CreateManualBlockDto, 'salonId'>) {
    const salonId = await this.getSalonId(userId);
    return this.prisma.manualBlock.create({
      data: {
        salonId,
        type: dto.type,
        scope: dto.scope,
        date: new Date(dto.date),
        halfDay: dto.halfDay,
        startTime: dto.startTime,
        endTime: dto.endTime,
        targetTableId: dto.targetTableId,
        targetStaffId: dto.targetStaffId,
        reason: dto.reason,
      },
    });
  }

  async findAll(userId: string) {
    const salonId = await this.getSalonId(userId);
    return this.prisma.manualBlock.findMany({
      where: { salonId },
      orderBy: { date: 'asc' },
    });
  }

  async remove(userId: string, blockId: string) {
    const salonId = await this.getSalonId(userId);
    const block = await this.prisma.manualBlock.findUnique({ where: { id: blockId } });
    if (!block || block.salonId !== salonId) throw new NotFoundException('Blocage non trouvé');
    return this.prisma.manualBlock.delete({ where: { id: blockId } });
  }
}
