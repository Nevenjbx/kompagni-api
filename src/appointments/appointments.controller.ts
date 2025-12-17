import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    UseGuards,
    Request,
    Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import {
    CreateAppointmentDto,
    UpdateAppointmentStatusDto,
} from './dto/appointment.dto';
import { AuthGuard } from '../common/guards/auth.guard';

@ApiTags('Appointments')
@Controller('appointments')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AppointmentsController {
    constructor(private readonly appointmentsService: AppointmentsService) { }

    @Post()
    @ApiOperation({ summary: 'Book an appointment' })
    create(@Request() req, @Body() createAppointmentDto: CreateAppointmentDto) {
        return this.appointmentsService.create(req.user.id, createAppointmentDto);
    }

    @Get('available-slots')
    @ApiOperation({ summary: 'Get available time slots' })
    @ApiQuery({ name: 'providerId' })
    @ApiQuery({ name: 'serviceId' })
    @ApiQuery({ name: 'date', description: 'YYYY-MM-DD' })
    getAvailableSlots(
        @Query('providerId') providerId: string,
        @Query('serviceId') serviceId: string,
        @Query('date') date: string,
    ) {
        return this.appointmentsService.getAvailableSlots(providerId, serviceId, date);
    }

    @Get()
    @ApiOperation({ summary: 'Get my appointments (Client or Provider)' })
    findAll(@Request() req) {
        return this.appointmentsService.findAllMy(req.user.id);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get appointment details' })
    findOne(@Param('id') id: string) {
        return this.appointmentsService.findOne(id);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update appointment status' })
    updateStatus(
        @Request() req,
        @Param('id') id: string,
        @Body() updateStatusDto: UpdateAppointmentStatusDto,
    ) {
        return this.appointmentsService.updateStatus(req.user.id, id, updateStatusDto);
    }
}
