import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { KairosEngineService } from './kairos-engine.service';
import { LockManagerService } from './lock-manager.service';

@Module({
  imports: [PrismaModule],
  providers: [KairosEngineService, LockManagerService],
  exports: [KairosEngineService, LockManagerService],
})
export class KairosModule {}
