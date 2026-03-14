import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { StaffService } from './staff.service';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';

@ApiTags('Staff')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateStaffDto) {
    return this.staffService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.staffService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.staffService.findOne(req.user.id, id);
  }

  @Put(':id')
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.staffService.remove(req.user.id, id);
  }
}
