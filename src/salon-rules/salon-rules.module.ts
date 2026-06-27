import { Module } from '@nestjs/common';
import { SalonRulesController } from './salon-rules.controller';
import { SalonRulesService } from './salon-rules.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SalonRulesController],
  providers: [SalonRulesService],
  exports: [SalonRulesService],
})
export class SalonRulesModule {}
