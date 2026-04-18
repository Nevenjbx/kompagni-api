import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { RulesService } from './rules.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('rules')
@UseGuards(AuthGuard)
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  // --- BaseRules ---
  @Post('base')
  createBaseRule(@Req() req: AuthenticatedRequest, @Body() createDto: any) {
    return this.rulesService.createBaseRule(req.user.id, createDto);
  }

  @Get('base/service/:serviceId')
  findBaseRulesForService(@Req() req: AuthenticatedRequest, @Param('serviceId') serviceId: string) {
    return this.rulesService.findBaseRulesForService(req.user.id, serviceId);
  }

  @Patch('base/:id')
  updateBaseRule(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() updateDto: any) {
    return this.rulesService.updateBaseRule(req.user.id, id, updateDto);
  }

  @Delete('base/:id')
  deleteBaseRule(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.rulesService.deleteBaseRule(req.user.id, id);
  }

  // --- ModifierRules ---
  @Post('modifiers')
  createModifierRule(@Req() req: AuthenticatedRequest, @Body() createDto: any) {
    return this.rulesService.createModifierRule(req.user.id, createDto);
  }

  @Get('modifiers')
  findModifierRules(@Req() req: AuthenticatedRequest) {
    return this.rulesService.findModifierRules(req.user.id);
  }

  @Patch('modifiers/:id')
  updateModifierRule(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() updateDto: any) {
    return this.rulesService.updateModifierRule(req.user.id, id, updateDto);
  }
}
