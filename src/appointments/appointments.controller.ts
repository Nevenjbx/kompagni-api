import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentStatusDto,
} from './dto/appointment.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Appointments')
@Controller('appointments')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@Throttle({ default: { ttl: 60000, limit: 20 } }) // Stricter: 20 requests/minute for appointments
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) { }

  @Post()
  @ApiOperation({ summary: 'Book an appointment' })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() createAppointmentDto: CreateAppointmentDto,
  ) {
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
    return this.appointmentsService.getAvailableSlots(
      providerId,
      serviceId,
      date,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get my appointments (Client or Provider)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20)' })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);
    return this.appointmentsService.findAllMy(req.user.id, pageNum, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment details' })
  findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update appointment status' })
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateAppointmentStatusDto,
  ) {
    return this.appointmentsService.updateStatus(
      req.user.id,
      id,
      updateStatusDto,
    );
  }
}
