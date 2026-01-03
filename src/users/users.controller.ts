import { Controller, Get, UseGuards, Post, Req, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Users')
@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) { }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all users (Admin only)' })
  async getAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@Req() req: AuthenticatedRequest) {
    return this.usersService.findById(req.user.id);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync Supabase user to Prisma' })
  async syncUser(
    @Req() req: AuthenticatedRequest,
    @Body() body: {
      role: Role;
      name?: string;
      phoneNumber?: string;
      providerProfile?: {
        businessName: string;
        description?: string;
        address: string;
        city: string;
        postalCode: string;
        latitude?: number;
        longitude?: number;
        tags?: string[];
      };
    },
  ) {
    return this.usersService.syncUser(
      req.user.id,
      req.user.email!,
      body.role,
      body.name,
      body.phoneNumber,
      body.providerProfile,
    );
  }
}
