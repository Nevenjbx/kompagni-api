import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { SlotEngineService } from './slot-engine.service';
import { ManualBlocksService } from './manual-blocks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [PrismaModule, SupabaseModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, SlotEngineService, ManualBlocksService],
  exports: [AppointmentsService, SlotEngineService],
})
export class AppointmentsModule {}
