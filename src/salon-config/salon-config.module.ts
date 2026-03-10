import { Module } from '@nestjs/common';
import { SalonConfigService } from './salon-config.service';
import { SalonConfigController } from './salon-config.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [PrismaModule, SupabaseModule],
  controllers: [SalonConfigController],
  providers: [SalonConfigService],
  exports: [SalonConfigService],
})
export class SalonConfigModule {}
