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

  async syncUser(
    id: string,
    email: string,
    role: import('@prisma/client').Role,
    name?: string,
    providerProfileData?: {
      businessName: string;
      description?: string;
      address: string;
      city: string;
      postalCode: string;
    },
  ) {
    // 1. Upsert User
    const user = await this.prisma.user.upsert({
      where: { id },
      update: { email, role, name },
      create: {
        id,
        email,
        role,
        name,
      },
    });

    // 2. If Provider and profile data exists, upsert Profile
    if (role === 'PROVIDER' && providerProfileData) {
      await this.prisma.providerProfile.upsert({
        where: { userId: id },
        update: {
          businessName: providerProfileData.businessName,
          description: providerProfileData.description,
          address: providerProfileData.address,
          city: providerProfileData.city,
          postalCode: providerProfileData.postalCode,
        },
        create: {
          userId: id,
          businessName: providerProfileData.businessName,
          description: providerProfileData.description,
          address: providerProfileData.address,
          city: providerProfileData.city,
          postalCode: providerProfileData.postalCode,
        },
      });
    }

    return user;
  }
}
