import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
    Query,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('services')
export class ServicesController {
    constructor(private readonly servicesService: ServicesService) { }

    @UseGuards(AuthGuard)
    @Post()
    create(@Request() req, @Body() createServiceDto: CreateServiceDto) {
        return this.servicesService.create(req.user.id, createServiceDto);
    }

    @Get()
    findAll(@Query('providerId') providerId?: string) {
        return this.servicesService.findAll(providerId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.servicesService.findOne(id);
    }

    @UseGuards(AuthGuard)
    @Patch(':id')
    update(
        @Request() req,
        @Param('id') id: string,
        @Body() updateServiceDto: UpdateServiceDto,
    ) {
        return this.servicesService.update(req.user.id, id, updateServiceDto);
    }

    @UseGuards(AuthGuard)
    @Delete(':id')
    remove(@Request() req, @Param('id') id: string) {
        return this.servicesService.remove(req.user.id, id);
    }
}
