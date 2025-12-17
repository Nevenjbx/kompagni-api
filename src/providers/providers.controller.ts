import { Controller, Get, Post, Body, Patch, UseGuards, Request, Put } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { CreateProviderDto, UpdateProviderDto, WorkingHoursDto } from './dto/provider.dto';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('providers')
export class ProvidersController {
    constructor(private readonly providersService: ProvidersService) { }

    @UseGuards(AuthGuard)
    @Post()
    create(@Request() req, @Body() createProviderDto: CreateProviderDto) {
        return this.providersService.create(req.user.id, createProviderDto);
    }

    @UseGuards(AuthGuard)
    @Get('me')
    findOne(@Request() req) {
        return this.providersService.findOne(req.user.id);
    }

    @UseGuards(AuthGuard)
    @Patch('me')
    update(@Request() req, @Body() updateProviderDto: UpdateProviderDto) {
        return this.providersService.update(req.user.id, updateProviderDto);
    }

    @UseGuards(AuthGuard)
    @Put('me/working-hours')
    updateWorkingHours(@Request() req, @Body() workingHoursDto: WorkingHoursDto[]) {
        return this.providersService.updateWorkingHours(req.user.id, workingHoursDto);
    }
}
