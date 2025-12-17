import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { SupabaseHealthIndicator } from './indicators/supabase.health';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [TerminusModule, PrismaModule, SupabaseModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, SupabaseHealthIndicator],
})
export class HealthModule {}
