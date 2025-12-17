import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { SupabaseService } from './../src/supabase/supabase.service';
import { Role } from '@prisma/client';

/**
 * Comprehensive E2E Test Suite for Kompagni API
 *
 * This test suite covers the main user flows:
 * 1. Provider creates account and profile
 * 2. Provider adds a service
 * 3. Provider sets working hours
 * 4. Client searches for providers
 * 5. Client books an appointment
 * 6. Provider confirms appointment
 *
 * NOTE: The RolesGuard relies on user.role from Prisma, not Supabase.
 * We mock the SupabaseService.verifyToken to return a mock user,
 * but the actual role check happens via DB lookup in RolesGuard.
 * This test uses real database interactions.
 */

describe('Kompagni API - Full E2E Flow', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Mock user IDs (will be created in DB)
  const mockProviderId = 'e2e-test-provider-user-id';
  const mockClientId = 'e2e-test-client-user-id';

  // Data created during tests
  let providerProfileId: string;
  let serviceId: string;
  let appointmentId: string;

  // Mock SupabaseService to bypass real authentication
  const mockSupabaseService = {
    verifyToken: jest.fn(),
    getClient: jest.fn(),
    adminDeleteUser: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue(mockSupabaseService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Cleanup any leftover test data from previous runs
    await prisma.appointment.deleteMany({
      where: { clientId: mockClientId },
    });
    await prisma.service.deleteMany({
      where: { provider: { userId: mockProviderId } },
    });
    await prisma.workingHours.deleteMany({
      where: { provider: { userId: mockProviderId } },
    });
    await prisma.providerProfile.deleteMany({
      where: { userId: mockProviderId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [mockProviderId, mockClientId] } },
    });
  });

  afterAll(async () => {
    // Cleanup test data in reverse order of creation
    try {
      await prisma.appointment.deleteMany({
        where: { clientId: mockClientId },
      });
      await prisma.service.deleteMany({
        where: { provider: { userId: mockProviderId } },
      });
      await prisma.workingHours.deleteMany({
        where: { provider: { userId: mockProviderId } },
      });
      await prisma.providerProfile.deleteMany({
        where: { userId: mockProviderId },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [mockProviderId, mockClientId] } },
      });
    } catch (e) {
      console.error('Cleanup error:', e);
    }

    await app.close();
  });

  // =========================================
  // SETUP: Create test users in DB
  // =========================================
  describe('1. Setup Test Users', () => {
    it('should create a provider user in the database', async () => {
      const user = await prisma.user.create({
        data: {
          id: mockProviderId,
          email: 'e2e-provider@test.com',
          name: 'E2E Test Provider',
          role: Role.PROVIDER,
        },
      });
      expect(user.id).toBe(mockProviderId);
    });

    it('should create a client user in the database', async () => {
      const user = await prisma.user.create({
        data: {
          id: mockClientId,
          email: 'e2e-client@test.com',
          name: 'E2E Test Client',
          role: Role.CLIENT,
        },
      });
      expect(user.id).toBe(mockClientId);
    });
  });

  // =========================================
  // FLOW 1: Provider Profile Management
  // =========================================
  describe('2. Provider Profile Management', () => {
    beforeAll(async () => {
      // Get the actual user from DB to include role
      const dbUser = await prisma.user.findUnique({
        where: { id: mockProviderId },
      });
      // Mock token verification to return provider user with role
      mockSupabaseService.verifyToken.mockResolvedValue({
        id: mockProviderId,
        email: 'e2e-provider@test.com',
        role: dbUser?.role,
      });
    });

    it('POST /providers - should create a provider profile', async () => {
      const response = await request(app.getHttpServer())
        .post('/providers')
        .set('Authorization', 'Bearer mock-provider-token')
        .send({
          businessName: 'E2E Salon Test',
          address: '123 Rue du Test',
          city: 'Paris',
          postalCode: '75001',
          description: 'Toilettage E2E',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.businessName).toBe('E2E Salon Test');
      providerProfileId = response.body.id;
    });

    it('GET /providers/me - should return own profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/providers/me')
        .set('Authorization', 'Bearer mock-provider-token')
        .expect(200);

      expect(response.body.id).toBe(providerProfileId);
      expect(response.body.businessName).toBe('E2E Salon Test');
    });

    it('PATCH /providers/me - should update provider profile', async () => {
      const response = await request(app.getHttpServer())
        .patch('/providers/me')
        .set('Authorization', 'Bearer mock-provider-token')
        .send({
          description: 'E2E Toilettage de luxe',
        })
        .expect(200);

      expect(response.body.description).toBe('E2E Toilettage de luxe');
    });
  });

  // =========================================
  // FLOW 2: Service Management
  // =========================================
  describe('3. Service Management', () => {
    beforeAll(async () => {
      const dbUser = await prisma.user.findUnique({
        where: { id: mockProviderId },
      });
      mockSupabaseService.verifyToken.mockResolvedValue({
        id: mockProviderId,
        email: 'e2e-provider@test.com',
        role: dbUser?.role,
      });
    });

    it('POST /services - should create a service', async () => {
      const response = await request(app.getHttpServer())
        .post('/services')
        .set('Authorization', 'Bearer mock-provider-token')
        .send({
          name: 'E2E Toilettage Chien',
          description: 'Bain, coupe, griffes, oreilles',
          duration: 60,
          price: 50.0,
          animalType: 'DOG',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('E2E Toilettage Chien');
      serviceId = response.body.id;
    });

    it('GET /services - should list services', async () => {
      const response = await request(app.getHttpServer())
        .get('/services')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Find our service
      const ourService = response.body.find((s: any) => s.id === serviceId);
      expect(ourService).toBeDefined();
    });

    it('GET /services/:id - should get service details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/services/${serviceId}`)
        .expect(200);

      expect(response.body.id).toBe(serviceId);
      expect(response.body.duration).toBe(60);
    });
  });

  // =========================================
  // FLOW 3: Working Hours
  // =========================================
  describe('4. Working Hours Management', () => {
    beforeAll(async () => {
      const dbUser = await prisma.user.findUnique({
        where: { id: mockProviderId },
      });
      mockSupabaseService.verifyToken.mockResolvedValue({
        id: mockProviderId,
        email: 'e2e-provider@test.com',
        role: dbUser?.role,
      });
    });

    it('PUT /providers/me/working-hours - should set working hours', async () => {
      const workingHours = [
        {
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '17:00',
          breakStartTime: '12:00',
          breakEndTime: '13:00',
        },
        {
          dayOfWeek: 2, // Tuesday
          startTime: '09:00',
          endTime: '17:00',
        },
        {
          dayOfWeek: 3, // Wednesday
          startTime: '09:00',
          endTime: '17:00',
        },
        {
          dayOfWeek: 4, // Thursday
          startTime: '09:00',
          endTime: '17:00',
        },
        {
          dayOfWeek: 5, // Friday
          startTime: '09:00',
          endTime: '17:00',
        },
      ];

      const response = await request(app.getHttpServer())
        .put('/providers/me/working-hours')
        .set('Authorization', 'Bearer mock-provider-token')
        .send(workingHours)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(5);
    });
  });

  // =========================================
  // FLOW 4: Provider Search (Public)
  // =========================================
  describe('5. Provider Search', () => {
    it('GET /providers/search - should find providers by city', async () => {
      const response = await request(app.getHttpServer())
        .get('/providers/search?q=Paris')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Our E2E test provider should be in results
      const ourProvider = response.body.find(
        (p: any) => p.id === providerProfileId,
      );
      expect(ourProvider).toBeDefined();
    });

    it('GET /providers/search - should filter by animal type', async () => {
      const response = await request(app.getHttpServer())
        .get('/providers/search?animalType=DOG')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // =========================================
  // FLOW 5: Appointment Booking (Client)
  // =========================================
  describe('6. Appointment Booking', () => {
    let bookingDate: Date;

    beforeAll(async () => {
      // Switch to Client user
      const dbUser = await prisma.user.findUnique({
        where: { id: mockClientId },
      });
      mockSupabaseService.verifyToken.mockResolvedValue({
        id: mockClientId,
        email: 'e2e-client@test.com',
        role: dbUser?.role,
      });

      // Calculate next available weekday (Mon-Fri) to ensure working hours exist
      const today = new Date();
      let dayOffset = 1;
      bookingDate = new Date(today);
      bookingDate.setDate(today.getDate() + dayOffset);

      // Find a weekday (1-5 = Mon-Fri)
      while (bookingDate.getDay() === 0 || bookingDate.getDay() === 6) {
        dayOffset++;
        bookingDate = new Date(today);
        bookingDate.setDate(today.getDate() + dayOffset);
      }
    });

    it('GET /appointments/available-slots - should return available slots', async () => {
      const dateStr = bookingDate.toISOString().split('T')[0];

      const response = await request(app.getHttpServer())
        .get(
          `/appointments/available-slots?providerId=${providerProfileId}&serviceId=${serviceId}&date=${dateStr}`,
        )
        .set('Authorization', 'Bearer mock-client-token')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Should have some slots available
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('POST /appointments - should book an appointment', async () => {
      // Book at 10:00 on our booking date
      const bookingTime = new Date(bookingDate);
      bookingTime.setHours(10, 0, 0, 0);

      const response = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', 'Bearer mock-client-token')
        .send({
          serviceId: serviceId,
          startTime: bookingTime.toISOString(),
          notes: 'E2E test appointment',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('PENDING');
      appointmentId = response.body.id;
    });

    it('GET /appointments - should list client appointments', async () => {
      const response = await request(app.getHttpServer())
        .get('/appointments')
        .set('Authorization', 'Bearer mock-client-token')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const ourAppointment = response.body.find(
        (a: any) => a.id === appointmentId,
      );
      expect(ourAppointment).toBeDefined();
    });

    it('GET /appointments/:id - should get appointment details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/appointments/${appointmentId}`)
        .set('Authorization', 'Bearer mock-client-token')
        .expect(200);

      expect(response.body.id).toBe(appointmentId);
      expect(response.body.notes).toBe('E2E test appointment');
    });
  });

  // =========================================
  // FLOW 6: Provider Manages Appointment
  // =========================================
  describe('7. Provider Appointment Management', () => {
    beforeAll(async () => {
      // Switch back to Provider
      const dbUser = await prisma.user.findUnique({
        where: { id: mockProviderId },
      });
      mockSupabaseService.verifyToken.mockResolvedValue({
        id: mockProviderId,
        email: 'e2e-provider@test.com',
        role: dbUser?.role,
      });
    });

    it('PATCH /appointments/:id/status - should confirm appointment', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/appointments/${appointmentId}/status`)
        .set('Authorization', 'Bearer mock-provider-token')
        .send({
          status: 'CONFIRMED',
        })
        .expect(200);

      expect(response.body.status).toBe('CONFIRMED');
    });

    it('PATCH /appointments/:id/status - should complete appointment', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/appointments/${appointmentId}/status`)
        .set('Authorization', 'Bearer mock-provider-token')
        .send({
          status: 'COMPLETED',
        })
        .expect(200);

      expect(response.body.status).toBe('COMPLETED');
    });
  });

  // =========================================
  // Edge Cases & Error Handling
  // =========================================
  describe('8. Error Handling', () => {
    it('should return 401 without authorization header', async () => {
      await request(app.getHttpServer()).get('/appointments').expect(401);
    });

    it('should return 400 for invalid appointment data', async () => {
      const dbUser = await prisma.user.findUnique({
        where: { id: mockClientId },
      });
      mockSupabaseService.verifyToken.mockResolvedValue({
        id: mockClientId,
        email: 'e2e-client@test.com',
        role: dbUser?.role,
      });

      await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', 'Bearer mock-client-token')
        .send({
          // Missing required fields
          notes: 'Invalid booking',
        })
        .expect(400);
    });

    it('should return 404 for non-existent service', async () => {
      await request(app.getHttpServer())
        .get('/services/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });
});
