import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateAppointmentDto,
    UpdateAppointmentStatusDto,
} from './dto/appointment.dto';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(isBetween);
dayjs.extend(customParseFormat);


@Injectable()
export class AppointmentsService {
    constructor(private prisma: PrismaService) { }

    async create(clientId: string, dto: CreateAppointmentDto) {
        // 1. Get Service details
        const service = await this.prisma.service.findUnique({
            where: { id: dto.serviceId },
            include: { provider: { include: { workingHours: true } } },
        });

        if (!service) {
            throw new NotFoundException('Service not found');
        }

        const providerId = service.providerId;
        const start = dayjs(dto.startTime);
        const end = start.add(service.duration, 'minute');

        // 2. Validate Working Hours
        const dayOfWeek = start.day(); // 0-6
        const workingHours = service.provider.workingHours.find(
            (wh) => wh.dayOfWeek === dayOfWeek,
        );

        if (!workingHours) {
            throw new BadRequestException('Provider does not work on this day');
        }

        // Parse "HH:mm" strings to dayjs objects on the same date as appointment
        const [startH, startM] = workingHours.startTime.split(':').map(Number);
        const [endH, endM] = workingHours.endTime.split(':').map(Number);

        const workStart = start.hour(startH).minute(startM).second(0).millisecond(0);
        const workEnd = start.hour(endH).minute(endM).second(0).millisecond(0);

        // Check strict inclusion: workStart <= start AND end <= workEnd
        if (start.isBefore(workStart) || end.isAfter(workEnd)) {
            throw new BadRequestException(
                'Appointment time is outside of working hours',
            );
        }

        // 3. Check for Overlaps with other appointments (same provider)
        // Overlap condition: (StartA < EndB) and (EndA > StartB)
        const overlap = await this.prisma.appointment.findFirst({
            where: {
                providerId,
                status: { not: 'CANCELLED' },
                startTime: { lt: end.toDate() },
                endTime: { gt: start.toDate() },
            },
        });

        if (overlap) {
            throw new BadRequestException('This time slot is already booked');
        }

        // 4. Create Appointment
        return this.prisma.appointment.create({
            data: {
                clientId,
                providerId,
                serviceId: dto.serviceId,
                startTime: start.toDate(),
                endTime: end.toDate(),
                notes: dto.notes,
                status: 'PENDING',
            },
            include: {
                service: true,
                provider: true,
            },
        });
    }

    async findAllMy(userId: string) {
        const whereConditions: any[] = [{ clientId: userId }];
        const profile = await this.prisma.providerProfile.findUnique({ where: { userId } });
        if (profile) {
            whereConditions.push({ providerId: profile.id });
        }

        return this.prisma.appointment.findMany({
            where: { OR: whereConditions },
            include: { service: true, provider: true, client: true },
            orderBy: { startTime: 'desc' },
        });
    }

    async findOne(id: string) {
        return this.prisma.appointment.findUnique({
            where: { id },
            include: { service: true, provider: true, client: true },
        });
    }

    async updateStatus(
        userId: string,
        appointmentId: string,
        dto: UpdateAppointmentStatusDto,
    ) {
        const appointment = await this.findOne(appointmentId);
        if (!appointment) throw new NotFoundException('Appointment not found');

        // Authz: Only Client or Provider involved can update status
        // Note: Usually clients cancel, Providers confirm/cancel/complete.
        // For simplicity, we allow both to cancel. Only Provider can Confirm/Complete.

        // Check if user is the client
        const isClient = appointment.clientId === userId;

        // Check if user is the provider
        // We need to resolve userId to providerId to check
        let isProvider = false;
        const providerProfile = await this.prisma.providerProfile.findUnique({ where: { userId } });
        if (providerProfile && providerProfile.id === appointment.providerId) {
            isProvider = true;
        }

        if (!isClient && !isProvider) {
            throw new ForbiddenException('Not authorized to update this appointment');
        }

        if (isClient) {
            // Client can only CANCEL
            if (dto.status !== 'CANCELLED') {
                throw new ForbiddenException('Clients can only cancel appointments');
            }
        }

        return this.prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: dto.status },
        });
    }
}
