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
import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) { }

  async create(clientId: string, dto: CreateAppointmentDto) {
    // Use Transaction with Serializable isolation for race condition prevention
    try {
      const appointment = await this.prisma.$transaction(
        async (tx) => {
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

          // Parse "HH:mm" strings
          const [startH, startM] = workingHours.startTime
            .split(':')
            .map(Number);
          const [endH, endM] = workingHours.endTime.split(':').map(Number);

          const workStart = start
            .hour(startH)
            .minute(startM)
            .second(0)
            .millisecond(0);
          const workEnd = start
            .hour(endH)
            .minute(endM)
            .second(0)
            .millisecond(0);

          // Check strict inclusion
          if (start.isBefore(workStart) || end.isAfter(workEnd)) {
            throw new BadRequestException(
              'Appointment time is outside of working hours',
            );
          }

          // 2b. Check Lunch Break
          if (workingHours.breakStartTime && workingHours.breakEndTime) {
            const [bStartH, bStartM] = workingHours.breakStartTime
              .split(':')
              .map(Number);
            const [bEndH, bEndM] = workingHours.breakEndTime
              .split(':')
              .map(Number);

            const breakStart = start
              .hour(bStartH)
              .minute(bStartM)
              .second(0)
              .millisecond(0);
            const breakEnd = start
              .hour(bEndH)
              .minute(bEndM)
              .second(0)
              .millisecond(0);

            // Overlap with break: (Start < BreakEnd) and (End > BreakStart)
            if (start.isBefore(breakEnd) && end.isAfter(breakStart)) {
              throw new BadRequestException(
                'Appointment time is during lunch break',
              );
            }
          }

          // 2c. Check Absences
          const absence = await tx.providerAbsence.findFirst({
            where: {
              providerId,
              startDate: { lte: end.toDate() },
              endDate: { gte: start.toDate() },
            },
          });

          if (absence) {
            throw new BadRequestException(
              'Provider is absent during this time',
            );
          }

          // 3. Check for Overlaps with other appointments
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
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return appointment;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2034: Serialization conflict
        if (error.code === 'P2034') {
          throw new BadRequestException(
            'This time slot was just booked by someone else. Please try again.',
          );
        }
      }
      throw error;
    }
  }

  async findAllMy(userId: string, page: number = 1, limit: number = 20) {
    const whereConditions: any[] = [{ clientId: userId }];
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
    });
    if (profile) {
      whereConditions.push({ providerId: profile.id });
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { OR: whereConditions },
        include: { service: true, provider: true, client: true },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.appointment.count({
        where: { OR: whereConditions },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
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

    const isClient = appointment.clientId === userId;
    let isProvider = false;
    const providerProfile = await this.prisma.providerProfile.findUnique({
      where: { userId },
    });
    if (providerProfile && providerProfile.id === appointment.providerId) {
      isProvider = true;
    }

    if (!isClient && !isProvider) {
      throw new ForbiddenException('Not authorized to update this appointment');
    }

    if (isClient) {
      if (dto.status !== 'CANCELLED') {
        throw new ForbiddenException('Clients can only cancel appointments');
      }
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: dto.status },
    });
  }

  async getAvailableSlots(providerId: string, serviceId: string, date: string) {
    const targetDate = dayjs(date, 'YYYY-MM-DD', true);
    if (!targetDate.isValid())
      throw new BadRequestException('Invalid date format YYYY-MM-DD');

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) throw new NotFoundException('Service not found');
    if (service.providerId !== providerId)
      throw new BadRequestException('Service does not belong to provider');

    const dayOfWeek = targetDate.day();
    const workingHours = await this.prisma.workingHours.findFirst({
      where: { providerId, dayOfWeek },
    });

    if (!workingHours) return [];

    const [startH, startM] = workingHours.startTime.split(':').map(Number);
    const [endH, endM] = workingHours.endTime.split(':').map(Number);

    const workStart = targetDate
      .hour(startH)
      .minute(startM)
      .second(0)
      .millisecond(0);
    const workEnd = targetDate.hour(endH).minute(endM).second(0).millisecond(0);

    // Get Absences
    const absences = await this.prisma.providerAbsence.findMany({
      where: {
        providerId,
        startDate: { lte: workEnd.toDate() },
        endDate: { gte: workStart.toDate() },
      },
    });

    // Check if whole day is absent
    const isFullDayAbsence = absences.some(
      (abs) =>
        dayjs(abs.startDate).isSameOrBefore(workStart) &&
        dayjs(abs.endDate).isSameOrAfter(workEnd),
    );
    if (isFullDayAbsence) return [];

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        providerId,
        status: { not: 'CANCELLED' },
        startTime: { gte: workStart.toDate(), lt: workEnd.toDate() },
      },
    });

    const slots: string[] = [];
    let cursor = workStart;
    const stepMinutes = service.duration;

    // Prepare Break times if any
    let breakStart: dayjs.Dayjs | null = null;
    let breakEnd: dayjs.Dayjs | null = null;

    if (workingHours.breakStartTime && workingHours.breakEndTime) {
      const [bStartH, bStartM] = workingHours.breakStartTime
        .split(':')
        .map(Number);
      const [bEndH, bEndM] = workingHours.breakEndTime.split(':').map(Number);
      breakStart = targetDate
        .hour(bStartH)
        .minute(bStartM)
        .second(0)
        .millisecond(0);
      breakEnd = targetDate.hour(bEndH).minute(bEndM).second(0).millisecond(0);
    }

    while (cursor.add(service.duration, 'minute').isSameOrBefore(workEnd)) {
      const slotEnd = cursor.add(service.duration, 'minute');

      // 1. Check Appointment Overlap
      const isApptOverlap = existingAppointments.some((appt) => {
        const apptStart = dayjs(appt.startTime);
        const apptEnd = dayjs(appt.endTime);
        return cursor.isBefore(apptEnd) && slotEnd.isAfter(apptStart);
      });

      // 2. Check Break Overlap
      let isBreakOverlap = false;
      if (breakStart && breakEnd) {
        // (Start < BreakEnd) and (End > BreakStart)
        if (cursor.isBefore(breakEnd) && slotEnd.isAfter(breakStart)) {
          isBreakOverlap = true;
        }
      }

      // 3. Check Absence Overlap
      const isAbsenceOverlap = absences.some((abs) => {
        const absStart = dayjs(abs.startDate);
        const absEnd = dayjs(abs.endDate);
        return cursor.isBefore(absEnd) && slotEnd.isAfter(absStart);
      });

      if (!isApptOverlap && !isBreakOverlap && !isAbsenceOverlap) {
        slots.push(cursor.toISOString());
      }

      cursor = cursor.add(stepMinutes, 'minute');
    }

    return slots;
  }
}
