import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { SalonConfigService } from './salon-config.service';
import { UpdateSalonConfigDto } from './dto/salon-config.dto';

@ApiTags('Salon Config')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('salon-config')
export class SalonConfigController {
  constructor(private readonly salonConfigService: SalonConfigService) {}

  @Get()
  get(@Req() req: AuthenticatedRequest) {
    return this.salonConfigService.get(req.user.id);
  }

  @Put()
  update(@Req() req: AuthenticatedRequest, @Body() dto: UpdateSalonConfigDto) {
    return this.salonConfigService.update(req.user.id, dto);
  }

  @Get('formation-available')
  async isFormationAvailable(@Req() req: AuthenticatedRequest) {
    const config = await this.salonConfigService.get(req.user.id);
    const available = await this.salonConfigService.isFormationAvailable(config.salonId);
    return { formationAvailable: available };
  }
}
