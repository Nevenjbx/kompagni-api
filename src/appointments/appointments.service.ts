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
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);
dayjs.extend(customParseFormat);




@Injectable()
export class AppointmentsService {
    constructor(
        private prisma: PrismaService,
    ) { }

    async create(clientId: string, dto: CreateAppointmentDto) {
        // Use Transaction for reliable booking
        const appointment = await this.prisma.$transaction(async (tx) => {
            // 1. Get Service details
            const service = await tx.service.findUnique({
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

            // 3. Check for Overlaps with other appointments (same provider) - LOCKING logic implicitly handled by serializable transactions or atomic checks
            // Overlap condition: (StartA < EndB) and (EndA > StartB)
            const overlap = await tx.appointment.findFirst({
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
            return tx.appointment.create({
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
        });

        // 5. Notify (outside transaction)


        return appointment;
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

        const updated = await this.prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: dto.status },
        });

        // if (dto.status === 'CONFIRMED') {
        //     this.eventEmitter.emit('appointment.confirmed', { appointmentId, clientId: appointment.clientId, providerId: appointment.providerId });
        // } else if (dto.status === 'CANCELLED') {
        //     this.eventEmitter.emit('appointment.cancelled', { appointmentId, clientId: appointment.clientId, providerId: appointment.providerId });
        // }

        return updated;
    }
    async getAvailableSlots(providerId: string, serviceId: string, date: string) {
        // Validate date format (YYYY-MM-DD)
        const targetDate = dayjs(date, 'YYYY-MM-DD', true);
        if (!targetDate.isValid()) throw new BadRequestException('Invalid date format YYYY-MM-DD');

        const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) throw new NotFoundException('Service not found');
        if (service.providerId !== providerId) throw new BadRequestException('Service does not belong to provider');

        // Get working hours for this day of week
        const dayOfWeek = targetDate.day(); // 0 is Sunday
        const workingHours = await this.prisma.workingHours.findFirst({
            where: { providerId, dayOfWeek },
        });

        if (!workingHours) return []; // No work today

        // Parse work start/end
        const [startH, startM] = workingHours.startTime.split(':').map(Number);
        const [endH, endM] = workingHours.endTime.split(':').map(Number);

        const workStart = targetDate.hour(startH).minute(startM).second(0).millisecond(0);
        const workEnd = targetDate.hour(endH).minute(endM).second(0).millisecond(0);

        // Get existing appointments for that day
        const existingAppointments = await this.prisma.appointment.findMany({
            where: {
                providerId,
                status: { not: 'CANCELLED' },
                startTime: { gte: workStart.toDate(), lt: workEnd.toDate() },
            },
        });

        const slots: string[] = [];
        let cursor = workStart;

        // Iterate in steps of 30 minutes (Doctolib style default) 
        // Logic: Try to fit service.duration at every interval
        // Requirement said "split ... into chunks based on service.duration".
        const stepMinutes = service.duration;

        while (cursor.add(service.duration, 'minute').isSameOrBefore(workEnd)) {
            const slotEnd = cursor.add(service.duration, 'minute');

            // Check overlap
            const isOverlap = existingAppointments.some(appt => {
                const apptStart = dayjs(appt.startTime);
                const apptEnd = dayjs(appt.endTime);

                // Overlap condition: (StartA < EndB) and (EndA > StartB)
                return cursor.isBefore(apptEnd) && slotEnd.isAfter(apptStart);
            });

            if (!isOverlap) {
                slots.push(cursor.toISOString());
            }

            cursor = cursor.add(stepMinutes, 'minute');
        }

        return slots;
    }
}
