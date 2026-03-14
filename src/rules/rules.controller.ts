import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { RulesService } from './rules.service';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('rules')
@UseGuards(AuthGuard)
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  // --- BaseRules ---
  @Post('base')
  createBaseRule(@Request() req, @Body() createDto: any) {
    const salonId = req.user.user_metadata.salonId || req.user.sub;
    return this.rulesService.createBaseRule(salonId, createDto);
  }

  @Get('base/service/:serviceId')
  findBaseRulesForService(@Request() req, @Param('serviceId') serviceId: string) {
    const salonId = req.user.user_metadata.salonId || req.user.sub;
    return this.rulesService.findBaseRulesForService(salonId, serviceId);
  }

  @Patch('base/:id')
  updateBaseRule(@Request() req, @Param('id') id: string, @Body() updateDto: any) {
    const salonId = req.user.user_metadata.salonId || req.user.sub;
    return this.rulesService.updateBaseRule(salonId, id, updateDto);
  }

  @Delete('base/:id')
  deleteBaseRule(@Request() req, @Param('id') id: string) {
    const salonId = req.user.user_metadata.salonId || req.user.sub;
    return this.rulesService.deleteBaseRule(salonId, id);
  }

  // --- ModifierRules ---
  @Post('modifiers')
  createModifierRule(@Request() req, @Body() createDto: any) {
    const salonId = req.user.user_metadata.salonId || req.user.sub;
    return this.rulesService.createModifierRule(salonId, createDto);
  }

  @Get('modifiers')
  findModifierRules(@Request() req) {
    const salonId = req.user.user_metadata.salonId || req.user.sub;
    return this.rulesService.findModifierRules(salonId);
  }

  @Patch('modifiers/:id')
  updateModifierRule(@Request() req, @Param('id') id: string, @Body() updateDto: any) {
    const salonId = req.user.user_metadata.salonId || req.user.sub;
    return this.rulesService.updateModifierRule(salonId, id, updateDto);
  }
}
