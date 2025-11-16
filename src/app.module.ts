import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [PrismaModule, UsersModule, SupabaseModule],
  controllers: [AppController],
  providers: [AppService],
  
})
export class AppModule {}

