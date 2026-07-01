import { Controller, Get, UseGuards, Post, Req, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { Public } from '../common/decorators/public.decorator';
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

  @Public()
  @Get('check-email')
  @ApiOperation({ summary: 'Check if an email exists' })
  async checkEmail(@Query('email') email: string) {
    if (!email) return { exists: false, role: null };
    return this.usersService.checkEmail(email);
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
      firstName?: string;
      lastName?: string;
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
      body.firstName,
      body.lastName,
      body.phoneNumber,
      body.providerProfile,
    );
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() body: import('./dto/update-user.dto').UpdateUserDto,
  ) {
    return this.usersService.updateUser(req.user.id, body);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete current user account' })
  async deleteMe(@Req() req: AuthenticatedRequest) {
    await this.usersService.deleteUser(req.user.id);
    return { success: true };
  }

  @Post('favorites/:providerId')
  @ApiOperation({ summary: 'Add a provider to favorites' })
  async addFavorite(
    @Req() req: AuthenticatedRequest,
    @Param('providerId') providerId: string,
  ) {
    return this.usersService.addFavorite(req.user.id, providerId);
  }

  @Delete('favorites/:providerId')
  @ApiOperation({ summary: 'Remove a provider from favorites' })
  async removeFavorite(
    @Req() req: AuthenticatedRequest,
    @Param('providerId') providerId: string,
  ) {
    return this.usersService.removeFavorite(req.user.id, providerId);
  }

  @Get('favorites')
  @ApiOperation({ summary: 'Get favorite providers' })
  async getFavorites(@Req() req: AuthenticatedRequest) {
    return this.usersService.getFavorites(req.user.id);
  }

  // --- Blocking ---

  @Post(':id/block')
  @Roles(Role.ADMIN, Role.PROVIDER)
  @ApiOperation({ summary: 'Block a client from booking' })
  async blockClient(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.usersService.blockClient(req.user, id, body.reason);
  }

  @Post(':id/unblock')
  @Roles(Role.ADMIN, Role.PROVIDER)
  @ApiOperation({ summary: 'Unblock a client' })
  async unblockClient(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.usersService.unblockClient(req.user, id);
  }
}
