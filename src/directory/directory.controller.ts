import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { DirectoryService } from './directory.service';

@ApiTags('Directory')
@Controller('directory')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.PROVIDER)
@ApiBearerAuth()
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Get('clients')
  @ApiOperation({ summary: 'List clients who have had appointments in this salon' })
  getClients(
    @Req() req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.directoryService.getClients(
      req.user.id,
      search,
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Get('pets')
  @ApiOperation({ summary: 'List pets who have had appointments in this salon' })
  getPets(
    @Req() req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('species') species?: string,
  ) {
    return this.directoryService.getPets(
      req.user.id,
      search,
      Number(page) || 1,
      Number(limit) || 20,
      species,
    );
  }

  @Get('clients/:clientId')
  @ApiOperation({ summary: 'Get detailed info for a client in this salon' })
  getClientDetail(
    @Req() req: AuthenticatedRequest,
    @Param('clientId') clientId: string,
  ) {
    return this.directoryService.getClientDetail(req.user.id, clientId);
  }

  @Get('pets/:petId')
  @ApiOperation({ summary: 'Get detailed info for a pet in this salon' })
  getPetDetail(
    @Req() req: AuthenticatedRequest,
    @Param('petId') petId: string,
  ) {
    return this.directoryService.getPetDetail(req.user.id, petId);
  }
}
