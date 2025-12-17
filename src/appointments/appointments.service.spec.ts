import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { Prisma } from '@prisma/client';
import { CreateAppointmentDto } from './dto/appointment.dto';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(isBetween);
dayjs.extend(customParseFormat);

const mockPrismaService = {
  $transaction: jest.fn(),
  service: { findUnique: jest.fn() },
  appointment: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  providerProfile: { findUnique: jest.fn() },
  workingHours: { findFirst: jest.fn() },
  providerAbsence: { findMany: jest.fn(), findFirst: jest.fn() },
};

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getAvailableSlots', () => {
    it('should return slots within working hours excluding booked ones', async () => {
      // Mock data
      (prisma.service.findUnique as jest.Mock).mockResolvedValue({
        id: 's1',
        providerId: 'p1',
        duration: 30,
      });
      (prisma.workingHours.findFirst as jest.Mock).mockResolvedValue({
        startTime: '09:00',
        endTime: '10:30',
        breakStartTime: null,
        breakEndTime: null,
      });

      const dateBase = dayjs('2023-12-25');
      const start900 = dateBase.hour(9).minute(0).second(0).millisecond(0);
      const start930 = dateBase.hour(9).minute(30).second(0).millisecond(0);
      const start1000 = dateBase.hour(10).minute(0).second(0).millisecond(0);

      (prisma.appointment.findMany as jest.Mock).mockResolvedValue([
        {
          startTime: start930.toDate(),
          endTime: start1000.toDate(),
        },
      ]);
      mockPrismaService.providerAbsence.findMany.mockResolvedValue([]);

      const slots = await service.getAvailableSlots('p1', 's1', '2023-12-25');
      expect(slots).toEqual([start900.toISOString(), start1000.toISOString()]);
    });

    it('should exclude lunch breaks', async () => {
      (prisma.service.findUnique as jest.Mock).mockResolvedValue({
        id: 's1',
        providerId: 'p1',
        duration: 60,
      });
      (prisma.workingHours.findFirst as jest.Mock).mockResolvedValue({
        startTime: '09:00',
        endTime: '14:00',
        breakStartTime: '12:00',
        breakEndTime: '13:00',
      });
      mockPrismaService.appointment.findMany.mockResolvedValue([]);
      mockPrismaService.providerAbsence.findMany.mockResolvedValue([]);

      const dateBase = dayjs('2023-12-25');
      const start1200 = dateBase.hour(12).minute(0).second(0).millisecond(0);

      const slots = await service.getAvailableSlots('p1', 's1', '2023-12-25');
      // 9, 10, 11, 13
      expect(slots.length).toBe(4);
      expect(slots).not.toContain(start1200.toISOString());
    });

    it('should exclude absences', async () => {
      (prisma.service.findUnique as jest.Mock).mockResolvedValue({
        id: 's1',
        providerId: 'p1',
        duration: 60,
      });
      (prisma.workingHours.findFirst as jest.Mock).mockResolvedValue({
        startTime: '09:00',
        endTime: '12:00',
      });

      const dateBase = dayjs('2023-12-25');
      const start900 = dateBase.hour(9).minute(0).second(0).millisecond(0);
      const start1000 = dateBase.hour(10).minute(0).second(0).millisecond(0);
      const start1100 = dateBase.hour(11).minute(0).second(0).millisecond(0);

      mockPrismaService.appointment.findMany.mockResolvedValue([]);
      mockPrismaService.providerAbsence.findMany.mockResolvedValue([
        {
          startDate: start1000.toDate(),
          endDate: start1100.toDate(),
        },
      ]);

      const slots = await service.getAvailableSlots('p1', 's1', '2023-12-25');
      expect(slots).toEqual([start900.toISOString(), start1100.toISOString()]);
    });
  });

  describe('create', () => {
    it('should create an appointment successfully', async () => {
      // Mock Transaction
      const mockTx = {
        service: {
          findUnique: jest.fn().mockResolvedValue({
            providerId: 'p1',
            duration: 60,
            provider: {
              workingHours: [
                {
                  dayOfWeek: 1, // Monday
                  startTime: '09:00',
                  endTime: '17:00',
                },
              ],
            },
          }),
        },
        providerAbsence: { findFirst: jest.fn().mockResolvedValue(null) },
        appointment: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'appt1' }),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: any) => Promise<any>) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return cb(mockTx);
        },
      );

      const dto: CreateAppointmentDto = {
        serviceId: 's1',
        startTime: dayjs('2023-12-25T10:00:00.000Z').toISOString(), // assume Monday
        notes: 'test',
      };

      const result = await service.create('c1', dto);
      expect(result).toEqual({ id: 'appt1' });
    });

    it('should throw BadRequest if overlaps with existing appointment', async () => {
      const mockTx = {
        service: {
          findUnique: jest.fn().mockResolvedValue({
            providerId: 'p1',
            duration: 60,
            provider: {
              workingHours: [
                {
                  dayOfWeek: 1,
                  startTime: '09:00',
                  endTime: '17:00',
                },
              ],
            },
          }),
        },
        providerAbsence: { findFirst: jest.fn().mockResolvedValue(null) },
        appointment: {
          findFirst: jest.fn().mockResolvedValue({ id: 'existing' }), // Overlap found
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: any) => Promise<any>) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return cb(mockTx);
        },
      );

      const dto: CreateAppointmentDto = {
        serviceId: 's1',
        startTime: dayjs('2023-12-25T10:00:00.000Z').toISOString(),
      };

      await expect(service.create('c1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle P2034 race condition error', async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Serialization failure', {
          code: 'P2034',
          clientVersion: '5.0.0',
        }),
      );

      const dto: CreateAppointmentDto = {
        serviceId: 's1',
        startTime: new Date().toISOString(),
      };

      await expect(service.create('c1', dto)).rejects.toThrow(
        'This time slot was just booked by someone else. Please try again.',
      );
    });
  });
});
