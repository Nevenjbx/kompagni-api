import { Module } from '@nestjs/common';
import { SectorTemplatesController } from './sector-templates.controller';
import { SectorTemplatesService } from './sector-templates.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SectorTemplatesController],
  providers: [SectorTemplatesService],
  exports: [SectorTemplatesService],
})
export class SectorTemplatesModule {}
