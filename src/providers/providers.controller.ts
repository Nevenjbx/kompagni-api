import { Controller, Get, Post, Body, Patch, UseGuards, Request, Put, Query } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { CreateProviderDto, UpdateProviderDto, WorkingHoursDto } from './dto/provider.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('providers')
export class ProvidersController {
    constructor(private readonly providersService: ProvidersService) { }

    @Get('search')
    findAll(@Query() query: import('./dto/search.dto').SearchProviderDto) {
        return this.providersService.search(query);
    }

    @UseGuards(AuthGuard, RolesGuard)
    @Roles(Role.PROVIDER)
    @Post()
    create(@Request() req, @Body() createProviderDto: CreateProviderDto) {
        return this.providersService.create(req.user.id, createProviderDto);
    }

    @UseGuards(AuthGuard)
    @Get('me')
    findOne(@Request() req) {
        return this.providersService.findOne(req.user.id);
    }

    @UseGuards(AuthGuard, RolesGuard)
    @Roles(Role.PROVIDER)
    @Patch('me')
    update(@Request() req, @Body() updateProviderDto: UpdateProviderDto) {
        return this.providersService.update(req.user.id, updateProviderDto);
    }

    @UseGuards(AuthGuard, RolesGuard)
    @Roles(Role.PROVIDER)
    @Put('me/working-hours')
    updateWorkingHours(@Request() req, @Body() workingHoursDto: WorkingHoursDto[]) {
        return this.providersService.updateWorkingHours(req.user.id, workingHoursDto);
    }
}
