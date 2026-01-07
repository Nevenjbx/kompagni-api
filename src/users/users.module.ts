import { Module, Global } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Global()
@Module({
  imports: [PrismaModule, SupabaseModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService], // Export UsersService for use in Guards
})
export class UsersModule { }
