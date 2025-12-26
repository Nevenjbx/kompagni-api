import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      console.log('AuthGuard: No authorization header');
      throw new UnauthorizedException('No authorization header found');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('AuthGuard: No token provided');
      throw new UnauthorizedException('No token provided');
    }

    // console.log('AuthGuard: Verifying token:', token.substring(0, 10) + '...');

    const user = await this.supabase.verifyToken(token);
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    // Attach user to request
    request.user = user;
    return true;
  }
}
