import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { ManualBlocksService } from './manual-blocks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { KairosModule } from '../kairos/kairos.module';

@Module({
  imports: [PrismaModule, SupabaseModule, KairosModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, ManualBlocksService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
