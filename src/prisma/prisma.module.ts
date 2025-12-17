import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Rend PrismaService disponible partout sans avoir à importer PrismaModule dans chaque module
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Permet aux autres modules d'utiliser PrismaService
})
export class PrismaModule {}
