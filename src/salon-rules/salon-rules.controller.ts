import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SalonRulesService } from './salon-rules.service';
import { CreateSalonRuleDto, UpdateSalonRuleDto, ReorderRulesDto } from './dto/salon-rule.dto';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('salon-rules')
@UseGuards(AuthGuard)
export class SalonRulesController {
  constructor(private readonly salonRulesService: SalonRulesService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.salonRulesService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.salonRulesService.findOne(req.user.id, id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateSalonRuleDto) {
    return this.salonRulesService.create(req.user.id, dto);
  }

  @Patch('reorder')
  reorder(@Req() req: any, @Body() dto: ReorderRulesDto) {
    return this.salonRulesService.reorder(req.user.id, dto.orderedIds);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSalonRuleDto) {
    return this.salonRulesService.update(req.user.id, id, dto);
  }

  @Patch(':id/toggle')
  toggle(@Req() req: any, @Param('id') id: string) {
    return this.salonRulesService.toggle(req.user.id, id);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.salonRulesService.remove(req.user.id, id);
  }
}
