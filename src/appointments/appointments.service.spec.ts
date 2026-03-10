import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { SlotEngineService } from './slot-engine.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma, OfferType } from '@prisma/client';

const mockPrismaService = {
  $transaction: jest.fn(),
  pet: { findUnique: jest.fn() },
  salonConfig: { findFirst: jest.fn() },
  appointment: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  providerProfile: { findUnique: jest.fn() },
};

const mockSlotEngineService = {
  generateSlots: jest.fn(),
  acquireLock: jest.fn(),
  validateLock: jest.fn(),
  releaseLock: jest.fn(),
  findNextAvailable: jest.fn(),
};

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SlotEngineService, useValue: mockSlotEngineService },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  describe('getAvailableSlots', () => {
    it('should delegate to slotEngine', async () => {
      mockSlotEngineService.generateSlots.mockResolvedValue({ pro: [] });
      const result = await service.getAvailableSlots('salon1', {
        serviceId: 's1',
        animalId: 'a1',
        offerType: 'PRO',
      });
      expect(mockSlotEngineService.generateSlots).toHaveBeenCalledWith({
        salonId: 'salon1',
        serviceId: 's1',
        animalId: 'a1',
        offerType: 'PRO',
      });
      expect(result).toEqual({ pro: [] });
    });
  });

  describe('create', () => {
    const dto = {
      serviceId: 's1',
      animalId: 'pet1',
      offerType: OfferType.PRO,
      lockToken: 'token1',
      slotStart: '2024-01-01T10:00:00Z',
      slotEnd: '2024-01-01T11:00:00Z',
      tableId: 't1',
      staffId: 'st1',
    };

    it('should throw BadRequestException if lock is invalid', async () => {
      mockSlotEngineService.validateLock.mockResolvedValue(false);
      mockSlotEngineService.findNextAvailable.mockResolvedValue(null);

      await expect(service.create('client1', 'salon1', dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if pet does not belong to client', async () => {
      mockSlotEngineService.validateLock.mockResolvedValue(true);
      mockPrismaService.pet.findUnique.mockResolvedValue({ ownerId: 'otherClient' });

      await expect(service.create('client1', 'salon1', dto)).rejects.toThrow(ForbiddenException);
    });

    it('should create an appointment if everything is valid', async () => {
      mockSlotEngineService.validateLock.mockResolvedValue(true);
      mockPrismaService.pet.findUnique.mockResolvedValue({ ownerId: 'client1' });
      mockPrismaService.salonConfig.findFirst.mockResolvedValue({ validationMode: 'AUTO' });

      const mockTx = {
        appointment: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'appt1' }),
        },
      };

      (mockPrismaService.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb(mockTx);
      });

      const result = await service.create('client1', 'salon1', dto);
      expect(result).toEqual({ id: 'appt1' });
      expect(mockSlotEngineService.releaseLock).toHaveBeenCalledWith('token1');
    });
  });
});

