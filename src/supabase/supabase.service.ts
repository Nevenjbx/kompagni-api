import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient;

  constructor(private config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_KEY');

    if (!url || !key) {
      this.logger.error('Missing Supabase credentials in .env');
      throw new Error('Supabase is not configured properly');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.supabase = createClient(url, key);
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  async verifyToken(token: string): Promise<User | null> {
    if (!token) return null;

    const { data, error } = await this.supabase.auth.getUser(token);

    if (error) {
      this.logger.warn(`Token validation failed: ${error.message}`);
      console.log('SupabaseService: Full error:', error);
      return null;
    }

    // console.log('SupabaseService: Token verified for user:', data.user.id);

    return data.user;
  }

  async verifyTokenLocal(token: string): Promise<{ sub: string; email?: string, app_metadata?: any, user_metadata?: any } | null> {
    const secret = this.config.get<string>('SUPABASE_JWT_SECRET');
    if (!secret) {
      this.logger.warn('SUPABASE_JWT_SECRET is not set. Skipping local verification.');
      return null;
    }

    try {
      const decoded = jwt.verify(token, secret) as any;
      return {
        sub: decoded.sub,
        email: decoded.email,
        app_metadata: decoded.app_metadata,
        user_metadata: decoded.user_metadata,
      };
    } catch (e) {
      this.logger.warn(`Local token verification failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
      return null;
    }
  }

  async adminDeleteUser(userId: string) {
    const { error } = await this.supabase.auth.admin.deleteUser(userId);
    if (error) this.logger.warn(`Failed to delete user ${userId}`);
  }
}
