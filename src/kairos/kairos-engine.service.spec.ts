import { Test, TestingModule } from '@nestjs/testing';
import { KairosEngineService } from './kairos-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnimalData } from '../engine/types';
import { AnimalCategory, CoatType, GroomingBehavior, SkinCondition } from '@prisma/client';

describe('KairosEngineService', () => {
  let service: KairosEngineService;
  let prisma: PrismaService;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T08:00:00Z')); // Monday 8am

    // We mock Prisma Service to track the number of calls
    const mockPrisma = {
      salonConfig: { findUnique: jest.fn().mockResolvedValue({ groomingTables: ['LARGE', 'SMALL', 'SMALL'], planningHorizonDays: 1, slotGranularityMin: 30 }) },
      user: { findUnique: jest.fn().mockResolvedValue({ isBlocked: false }) },
      staffMember: { findMany: jest.fn().mockResolvedValue([{ id: 'staff1', role: 'PROFESSIONAL', speedIndex: 1.0, allowedServiceIds: ['srv1'], weeklySchedule: '[]', leaves: '[]', followSalonSchedule: true }]) },
      workingHours: { findMany: jest.fn().mockResolvedValue([{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }]) },
      providerAbsence: { findMany: jest.fn().mockResolvedValue([]) },
      appointment: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      manualBlock: { findMany: jest.fn().mockResolvedValue([]) },
      baseRule: { findMany: jest.fn().mockResolvedValue([{ salonId: 'salon1', serviceId: 'srv1', minWeightKg: 0, maxWeightKg: 9999, baseDurationMinutes: 60, basePrice: 50, includedMinutes: 9999, overtimeRatePerMin: 0 }]) },
      modifierRule: { findMany: jest.fn().mockResolvedValue([]) },
      salonRule: { findMany: jest.fn().mockResolvedValue([]) },
      animalRefinement: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KairosEngineService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<KairosEngineService>(KairosEngineService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch all required data in a single initial batch phase', async () => {
    const animal: AnimalData = {
      id: 'pet1', species: 'dog', birthDate: new Date('2020-01-01'),
      isNeutered: true, weightKg: 10, category: AnimalCategory.SMALL,
      coatType: CoatType.SHORT, groomingBehavior: GroomingBehavior.EASY,
      skinCondition: SkinCondition.NORMAL, lastGroomedAt: new Date()
    };

    const result = await service.generate({ clientId: 'c1', salonId: 'salon1', serviceId: 'srv1', animal });
    
    // Config + User blocked check (2 queries)
    expect(prisma.salonConfig.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

    // Bulk fetch phase (8 parallel queries)
    expect(prisma.staffMember.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.workingHours.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.providerAbsence.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.appointment.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.manualBlock.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.baseRule.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.modifierRule.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.salonRule.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.animalRefinement.findFirst).toHaveBeenCalledTimes(1);
    
    // Ensure we generated slots
    expect(result.length).toBeGreaterThan(0); // Because horizon is 1 day and today is open
    expect(result[0].slots[0].quote.theoreticalDurationMinutes).toBe(60);
  });

  it('should restrict slots for a staff member with a custom schedule', async () => {
    const today = 1; // Monday
    (prisma.staffMember.findMany as jest.Mock).mockResolvedValue([{
      id: 'staff1', role: 'PROFESSIONAL', speedIndex: 1.0, allowedServiceIds: ['srv1'], 
      weeklySchedule: JSON.stringify([{ dayOfWeek: today, startTime: '09:00', endTime: '12:00' }]), 
      leaves: '[]', followSalonSchedule: false 
    }]);

    const animal: AnimalData = {
      id: 'pet1', species: 'dog', birthDate: new Date('2020-01-01'),
      isNeutered: true, weightKg: 10, category: AnimalCategory.SMALL,
      coatType: CoatType.SHORT, groomingBehavior: GroomingBehavior.EASY,
      skinCondition: SkinCondition.NORMAL, lastGroomedAt: new Date()
    };

    const result = await service.generate({ clientId: 'c1', salonId: 'salon1', serviceId: 'srv1', animal });
    
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].slots.length).toBeGreaterThan(0);
    
    // Custom staff finishes at 12:00, slot duration is 60min, so last slot is 11:00
    const lastSlot = result[0].slots[result[0].slots.length - 1];
    expect(lastSlot.start.getHours()).toBeLessThanOrEqual(11);
  });

  it('should return no slots for a day if custom schedule does not include it', async () => {
    (prisma.staffMember.findMany as jest.Mock).mockResolvedValue([{
      id: 'staff1', role: 'PROFESSIONAL', speedIndex: 1.0, allowedServiceIds: ['srv1'], 
      weeklySchedule: JSON.stringify([]), // Empty schedule = no working days
      leaves: '[]', followSalonSchedule: false 
    }]);

    const animal: AnimalData = {
      id: 'pet1', species: 'dog', birthDate: new Date('2020-01-01'),
      isNeutered: true, weightKg: 10, category: AnimalCategory.SMALL,
      coatType: CoatType.SHORT, groomingBehavior: GroomingBehavior.EASY,
      skinCondition: SkinCondition.NORMAL, lastGroomedAt: new Date()
    };

    const result = await service.generate({ clientId: 'c1', salonId: 'salon1', serviceId: 'srv1', animal });
    
    if (result.length > 0) {
      expect(result[0].slots.length).toBe(0);
    } else {
      expect(result.length).toBe(0);
    }
  });
});
