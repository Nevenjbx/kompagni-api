import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
      // Block UNSYNCED users unless the path contains '/users/sync'
      if (user && (user as any).role === 'UNSYNCED') {
        const request = context.switchToHttp().getRequest();
        if (request.url.includes('/users/sync')) {
          return true;
        }
        return false;
      }
      return true;
    }
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // If no user attached (AuthGuard missing or failed), deny
    if (!user) return false;

    // Admin has super access usually, but strict RBAC implies matching roles.
    // Let's assume ADMIN can access everything provided they have the ADMIN role,
    // or if we strictly check the list.
    // The requirement says "Ensure only users with PROVIDER role can access..."

    return requiredRoles.some((role) => user.role === role);
  }
}
