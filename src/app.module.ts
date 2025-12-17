import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { ProvidersModule } from './providers/providers.module';
import { ServicesModule } from './services/services.module';
import { AppointmentsModule } from './appointments/appointments.module';

@Module({
  imports: [PrismaModule, UsersModule, SupabaseModule, ProvidersModule, ServicesModule, AppointmentsModule],
  controllers: [AppController],
  providers: [AppService],

})
export class AppModule { }

