import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class SupabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly supabaseService: SupabaseService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const client = this.supabaseService.getClient();
      // Perform a simple auth check to verify Supabase connectivity
      await client.auth.getSession();
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'Supabase check failed',
        this.getStatus(key, false, { error: (error as Error).message }),
      );
    }
  }
}
