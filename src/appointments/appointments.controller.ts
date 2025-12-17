import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    UseGuards,
    Request,
    Query,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import {
    CreateAppointmentDto,
    UpdateAppointmentStatusDto,
} from './dto/appointment.dto';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('appointments')
@UseGuards(AuthGuard)
export class AppointmentsController {
    constructor(private readonly appointmentsService: AppointmentsService) { }

    @Post()
    create(@Request() req, @Body() createAppointmentDto: CreateAppointmentDto) {
        return this.appointmentsService.create(req.user.id, createAppointmentDto);
    }

    @Get('available-slots')
    getAvailableSlots(
        @Query('providerId') providerId: string,
        @Query('serviceId') serviceId: string,
        @Query('date') date: string,
    ) {
        return this.appointmentsService.getAvailableSlots(providerId, serviceId, date);
    }

    @Get()
    findAll(@Request() req) {
        // Determine context based on user role or request
        // Prisma User has a "role" field. We can use that.
        // req.user comes from Supabase, but our Prisma DB has the role.
        // However, the AuthGuard attaches the Supabase user object. 
        // We might need to fetch the Prisma user to know the role...
        // Or we just return all appointments where user is client OR provider?

        // For simplicity, let's assume we fetch both lists or check the role from the token metadata if available.
        // But since we don't have role in Supabase metadata ensured, let's fetch based on "Find appointments where I am client OR provider".
        // Actually, Service method takes a role arg. Let's make it smarter or just pass 'CLIENT' by default?
        // Let's improve the service to check "Where clientId = me OR provider.userId = me".

        // For now, I'll update the controller to try both or rely on a query param? No, that's insecure.
        // I will refactor the service slightly to handle "My Appointments" regardless of role.

        return this.appointmentsService.findAllMy(req.user.id);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.appointmentsService.findOne(id);
    }

    @Patch(':id/status')
    updateStatus(
        @Request() req,
        @Param('id') id: string,
        @Body() updateStatusDto: UpdateAppointmentStatusDto,
    ) {
        return this.appointmentsService.updateStatus(req.user.id, id, updateStatusDto);
    }
}
