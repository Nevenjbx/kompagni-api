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
    phoneNumber?: string,
    providerProfileData?: {
      businessName: string;
      description?: string;
      address: string;
      city: string;
      postalCode: string;
      latitude?: number;
      longitude?: number;
      tags?: string[];
    },
  ) {
    // 1. Upsert User
    const user = await this.prisma.user.upsert({
      where: { id },
      update: { email, role, name, phoneNumber },
      create: {
        id,
        email,
        role,
        name,
        phoneNumber,
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
          latitude: providerProfileData.latitude,
          longitude: providerProfileData.longitude,
          tags: providerProfileData.tags,
        },
        create: {
          userId: id,
          businessName: providerProfileData.businessName,
          description: providerProfileData.description,
          address: providerProfileData.address,
          city: providerProfileData.city,
          postalCode: providerProfileData.postalCode,
          latitude: providerProfileData.latitude,
          longitude: providerProfileData.longitude,
          tags: providerProfileData.tags,
        },
      });
    }

    return user;
  }

  async updateUser(userId: string, data: import('./dto/update-user.dto').UpdateUserDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.phoneNumber && { phoneNumber: data.phoneNumber }),
        // Note: Updating email here updates it in Prisma but NOT in Supabase Auth automatically.
        // It's usually better to change email via Supabase Auth client to ensure verification.
        // However, we will allow updating the record here for display purposes or if the client handled the auth update.
        ...(data.email && { email: data.email }),
      },
    });
  }

  async deleteUser(userId: string) {
    return this.prisma.user.delete({
      where: { id: userId },
    });
  }
}
