import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  UseGuards,
  Req,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { ProvidersService } from './providers.service';
import {
  CreateProviderDto,
  UpdateProviderDto,
  WorkingHoursDto,
} from './dto/provider.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Providers')
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search for providers' })
  @ApiResponse({
    status: 200,
    description: 'List of providers matching criteria',
  })
  findAll(@Query() query: import('./dto/search.dto').SearchProviderDto) {
    return this.providersService.search(query);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create provider profile' })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() createProviderDto: CreateProviderDto,
  ) {
    return this.providersService.create(req.user.id, createProviderDto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current provider profile' })
  findOne(@Req() req: AuthenticatedRequest) {
    return this.providersService.findOne(req.user.id);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Update provider profile' })
  update(
    @Req() req: AuthenticatedRequest,
    @Body() updateProviderDto: UpdateProviderDto,
  ) {
    return this.providersService.update(req.user.id, updateProviderDto);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  @ApiBearerAuth()
  @Put('me/working-hours')
  @ApiOperation({ summary: 'Update working hours' })
  @ApiBody({ type: [WorkingHoursDto] })
  updateWorkingHours(
    @Req() req: AuthenticatedRequest,
    @Body() workingHoursDto: WorkingHoursDto[],
  ) {
    return this.providersService.updateWorkingHours(
      req.user.id,
      workingHoursDto,
    );
  }
}
