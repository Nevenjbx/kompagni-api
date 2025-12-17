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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import { AuthGuard } from '../common/guards/auth.guard';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
    constructor(private readonly servicesService: ServicesService) { }

    @UseGuards(AuthGuard)
    @Post()
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new service' })
    create(@Request() req, @Body() createServiceDto: CreateServiceDto) {
        return this.servicesService.create(req.user.id, createServiceDto);
    }

    @Get()
    @ApiOperation({ summary: 'List services' })
    @ApiQuery({ name: 'providerId', required: false })
    findAll(@Query('providerId') providerId?: string) {
        return this.servicesService.findAll(providerId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a service details' })
    findOne(@Param('id') id: string) {
        return this.servicesService.findOne(id);
    }

    @UseGuards(AuthGuard)
    @Patch(':id')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a service' })
    update(
        @Request() req,
        @Param('id') id: string,
        @Body() updateServiceDto: UpdateServiceDto,
    ) {
        return this.servicesService.update(req.user.id, id, updateServiceDto);
    }

    @UseGuards(AuthGuard)
    @Delete(':id')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a service' })
    remove(@Request() req, @Param('id') id: string) {
        return this.servicesService.remove(req.user.id, id);
    }
}
