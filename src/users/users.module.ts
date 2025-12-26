import { Module, Global } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService], // Export UsersService for use in Guards
})
export class UsersModule { }
