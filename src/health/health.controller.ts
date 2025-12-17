import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { SupabaseHealthIndicator } from './indicators/supabase.health';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private supabaseHealth: SupabaseHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check API health status' })
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.supabaseHealth.isHealthy('supabase'),
    ]);
  }
}
