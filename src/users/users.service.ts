import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
  ) { }

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
    firstName?: string,
    lastName?: string,
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
    // 0. Clean up "Ghost Users" (Same email, different ID)
    // This happens if a user was deleted in Supabase but not locally, and then signs up again.
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingByEmail && existingByEmail.id !== id) {
      console.warn(`[SyncUser] Found potential ghost user with email ${email} (ID: ${existingByEmail.id}) while syncing new ID ${id}. Deleting old record.`);
      await this.prisma.user.delete({
        where: { id: existingByEmail.id },
      });
    }

    // 1. Upsert User
    const user = await this.prisma.user.upsert({
      where: { id },
      update: { email, role, firstName, lastName, phoneNumber },
      create: {
        id,
        email,
        role,
        firstName,
        lastName,
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
    // 1. If email is being updated, sync with Supabase Auth first
    if (data.email) {
      const success = await this.supabase.adminUpdateUserEmail(userId, data.email);
      if (!success) {
        this.logger.warn(`Email update in Supabase Auth failed for user ${userId}, proceeding with Prisma update only`);
      }
    }

    // 2. Update in Prisma
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.phoneNumber && { phoneNumber: data.phoneNumber }),
        ...(data.email && { email: data.email }),
      },
    });
  }

  async deleteUser(userId: string) {
    // 1. Delete from Supabase Auth first
    const authDeleted = await this.supabase.adminDeleteUser(userId);
    if (!authDeleted) {
      this.logger.warn(`Failed to delete user ${userId} from Supabase Auth, proceeding with Prisma deletion`);
    }

    // 2. Delete from Prisma (cascades to related records)
    return this.prisma.user.delete({
      where: { id: userId },
    });
  }

  async addFavorite(userId: string, providerId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        favoriteProviders: {
          connect: { id: providerId },
        },
      },
      include: { favoriteProviders: true },
    });
  }

  async removeFavorite(userId: string, providerId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        favoriteProviders: {
          disconnect: { id: providerId },
        },
      },
      include: { favoriteProviders: true },
    });
  }

  async getFavorites(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        favoriteProviders: {
          include: {
            user: {
              select: {
                phoneNumber: true,
              }
            }
          }
        }
      },
    });
    return user?.favoriteProviders || [];
  }
}
