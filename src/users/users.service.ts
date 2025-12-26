import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async syncUser(id: string, email: string, role: import('@prisma/client').Role) {
    return this.prisma.user.upsert({
      where: { id },
      update: { email, role },
      create: {
        id,
        email,
        role,
      },
    });
  }
}
