import { Controller, Get, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { DirectoryService } from './directory.service';
import { UpdateInternalClientDto, UpdateInternalPetDto } from './dto/update-internal.dto';

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
      req.user.providerProfileId!,
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
      req.user.providerProfileId!,
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
    return this.directoryService.getClientDetail(req.user.providerProfileId!, clientId);
  }

  @Get('pets/:petId')
  @ApiOperation({ summary: 'Get detailed info for a pet in this salon' })
  getPetDetail(
    @Req() req: AuthenticatedRequest,
    @Param('petId') petId: string,
  ) {
    return this.directoryService.getPetDetail(req.user.providerProfileId!, petId);
  }

  @Put('clients/:clientId/internal')
  @ApiOperation({ summary: 'Update detailed info for an internal client' })
  updateInternalClient(
    @Req() req: AuthenticatedRequest,
    @Param('clientId') clientId: string,
    @Body() dto: UpdateInternalClientDto,
  ) {
    return this.directoryService.updateInternalClient(req.user.providerProfileId!, clientId, dto);
  }

  @Put('pets/:petId/internal')
  @ApiOperation({ summary: 'Update detailed info for an internal pet' })
  updateInternalPet(
    @Req() req: AuthenticatedRequest,
    @Param('petId') petId: string,
    @Body() dto: UpdateInternalPetDto,
  ) {
    return this.directoryService.updateInternalPet(req.user.providerProfileId!, petId, dto);
  }
}
