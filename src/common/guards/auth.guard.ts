import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { SupabaseService } from '../../supabase/supabase.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly usersService: UsersService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      // console.log('AuthGuard: No authorization header');
      throw new UnauthorizedException('No authorization header found');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      // console.log('AuthGuard: No token provided');
      throw new UnauthorizedException('No token provided');
    }

    // 1. Try local verification first (faster)
    let authPayload = await this.supabase.verifyTokenLocal(token);

    // 2. Fallback to remote verification if local fails (e.g. secret missing or algorithm mismatch)
    if (!authPayload) {
      // console.log('AuthGuard: Local verification failed, trying remote...');
      const supabaseUser = await this.supabase.verifyToken(token);
      if (supabaseUser) {
        authPayload = { sub: supabaseUser.id, email: supabaseUser.email };
      }
    }

    if (!authPayload) {
      throw new UnauthorizedException('Invalid token');
    }

    // 3. Fetch user from Database (Prisma) to ensure we have the correct Role and permissions
    const dbUser = await this.usersService.findById(authPayload.sub);

    if (dbUser) {
      request.user = dbUser;
    } else {
      // User likely authenticated via Supabase but not yet synced to Prisma.
      // Attach a temporary object so they can access public or sync endpoints.
      // IMPORTANT: Role is defaulted to CLIENT to prevent unauthorized access if logic depends on it.
      // The 'sync' endpoint will update this.
      request.user = {
        id: authPayload.sub,
        email: authPayload.email ?? '',
        role: 'CLIENT',
        createdAt: new Date(),
        updatedAt: new Date(),
        // Casting as any because we miss some Prisma fields but adequate for Auth checks
      } as any;
    }

    return true;
  }
}
