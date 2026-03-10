import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { ProvidersModule } from './providers/providers.module';
import { ServicesModule } from './services/services.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { PetsModule } from './pets/pets.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { validateEnv } from './config/config.validation';
import { WaitlistModule } from './waitlist/waitlist.module';
import { StaffModule } from './staff/staff.module';
import { SalonConfigModule } from './salon-config/salon-config.module';
import { TablesModule } from './tables/tables.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 100,
        },
      ],
    }),
    PrismaModule,
    UsersModule,
    SupabaseModule,
    ProvidersModule,
    ServicesModule,
    AppointmentsModule,
    PetsModule,
    NotificationsModule,
    HealthModule,
    WaitlistModule,
    StaffModule,
    SalonConfigModule,
    TablesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }

