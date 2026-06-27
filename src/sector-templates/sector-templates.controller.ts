import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SectorTemplatesService } from './sector-templates.service';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('sector-templates')
export class SectorTemplatesController {
  constructor(private readonly sectorTemplatesService: SectorTemplatesService) {}

  @Get()
  findAll() {
    return this.sectorTemplatesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sectorTemplatesService.findOne(id);
  }

  @Post(':id/apply')
  @UseGuards(AuthGuard)
  apply(@Req() req: any, @Param('id') id: string) {
    return this.sectorTemplatesService.apply(req.user.id, id);
  }
}
