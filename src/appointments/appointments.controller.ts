import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { AppointmentsService } from './appointments.service';
import { ManualBlocksService } from './manual-blocks.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentStatusDto,
  GetSlotsDto,
  LockSlotDto,
} from './dto/appointment.dto';

@ApiTags('Appointments')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly manualBlocksService: ManualBlocksService,
  ) {}

  // ─── SLOTS ──────────────────────────────────────

  @Get('slots/:salonId')
  getSlots(@Param('salonId') salonId: string, @Query() dto: GetSlotsDto) {
    return this.appointmentsService.getAvailableSlots(salonId, dto);
  }

  @Post('slots/lock')
  lockSlot(@Body() dto: LockSlotDto) {
    return this.appointmentsService.lockSlot(dto);
  }

  // ─── RENDEZ-VOUS ────────────────────────────────

  @Post(':salonId')
  create(
    @Req() req: AuthenticatedRequest,
    @Param('salonId') salonId: string,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(req.user.id, salonId, dto);
  }

  @Get('my')
  findMyAppointments(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.appointmentsService.findAllForClient(req.user.id, Number(page) || 1, Number(limit) || 20);
  }

  @Get('salon')
  findSalonAppointments(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.appointmentsService.findAllForSalon(req.user.id, Number(page) || 1, Number(limit) || 50);
  }

  @Get('pending')
  findPending(@Req() req: AuthenticatedRequest) {
    return this.appointmentsService.findPending(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne(id);
  }

  @Put(':id/status')
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.appointmentsService.updateStatus(req.user.id, id, dto);
  }

  // ─── BLOCAGES MANUELS ──────────────────────────

  @Post('blocks')
  createBlock(@Req() req: AuthenticatedRequest, @Body() dto: any) {
    return this.manualBlocksService.create(req.user.id, dto);
  }

  @Get('blocks/all')
  findAllBlocks(@Req() req: AuthenticatedRequest) {
    return this.manualBlocksService.findAll(req.user.id);
  }

  @Delete('blocks/:id')
  removeBlock(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.manualBlocksService.remove(req.user.id, id);
  }
}
