import { Controller, Post, Body, Param, Delete, UseGuards, Request, Get } from '@nestjs/common';
import { PriceAdjustmentsService } from './price-adjustments.service';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('price-adjustments')
@UseGuards(AuthGuard)
export class PriceAdjustmentsController {
  constructor(private readonly priceAdjustmentsService: PriceAdjustmentsService) {}

  @Post()
  create(@Request() req, @Body() createDto: { appointmentId: string, amount: number, reason: string }) {
    const salonId = req.user.user_metadata.salonId || req.user.sub;
    const staffId = req.user.sub; // or whoever is authenticated
    return this.priceAdjustmentsService.create(salonId, staffId, createDto);
  }

  @Get('appointment/:appointmentId')
  findByAppointment(@Request() req, @Param('appointmentId') appointmentId: string) {
    const salonId = req.user.user_metadata.salonId || req.user.sub;
    return this.priceAdjustmentsService.findByAppointment(salonId, appointmentId);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    const salonId = req.user.user_metadata.salonId || req.user.sub;
    return this.priceAdjustmentsService.remove(salonId, id);
  }
}
