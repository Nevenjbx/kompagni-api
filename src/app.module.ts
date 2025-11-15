import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppService } from './app.service';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
  
})
export class AppModule {}

