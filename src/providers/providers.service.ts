import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderDto, UpdateProviderDto, WorkingHoursDto } from './dto/provider.dto';
import { ProviderProfile } from '@prisma/client';


@Injectable()
export class ProvidersService {
    constructor(private prisma: PrismaService) { }

    async create(userId: string, dto: CreateProviderDto): Promise<ProviderProfile> {
        // Check if user already has a profile
        const existing = await this.prisma.providerProfile.findUnique({
            where: { userId },
        });

        if (existing) {
            throw new Error('User already has a provider profile');
        }

        return this.prisma.providerProfile.create({
            data: {
                userId,
                ...dto,
            },
        });
    }

    async findOne(userId: string): Promise<ProviderProfile> {
        const profile = await this.prisma.providerProfile.findUnique({
            where: { userId },
            include: {
                services: true,
                workingHours: true,
            },
        });

        if (!profile) {
            throw new NotFoundException('Provider profile not found');
        }

        return profile;
    }

    async updateWorkingHours(userId: string, hours: WorkingHoursDto[]) {
        const profile = await this.findOne(userId);

        // Transaction: Delete existing hours for this provider and insert new ones
        return this.prisma.$transaction(async (tx) => {
            await tx.workingHours.deleteMany({
                where: { providerId: profile.id },
            });

            if (hours.length > 0) {
                await tx.workingHours.createMany({
                    data: hours.map((h) => ({
                        providerId: profile.id,
                        ...h,
                    })),
                });
            }

            return tx.workingHours.findMany({
                where: { providerId: profile.id },
            });
        });
    }

    async update(userId: string, dto: UpdateProviderDto): Promise<ProviderProfile> {
        try {
            return await this.prisma.providerProfile.update({
                where: { userId },
                data: dto,
            });
        } catch (error) { // eslint-disable-line @typescript-eslint/no-unused-vars
            throw new NotFoundException('Provider profile not found');
        }
    }
}
