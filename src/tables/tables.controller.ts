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
import { TablesService } from './tables.service';
import { CreateTableDto, UpdateTableDto } from './dto/table.dto';

@ApiTags('Tables')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateTableDto) {
    return this.tablesService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.tablesService.findAll(req.user.id);
  }

  @Put(':id')
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateTableDto) {
    return this.tablesService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.tablesService.remove(req.user.id, id);
  }
}
