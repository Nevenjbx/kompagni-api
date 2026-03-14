import { Module } from '@nestjs/common';
import { PriceAdjustmentsService } from './price-adjustments.service';
import { PriceAdjustmentsController } from './price-adjustments.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PriceAdjustmentsController],
  providers: [PriceAdjustmentsService],
  exports: [PriceAdjustmentsService],
})
export class PriceAdjustmentsModule {}
