import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Pet, PetSize, PetCharacter, AnimalType } from '@prisma/client';

@Injectable()
export class PetsService {
    constructor(private prisma: PrismaService) { }

    async createPet(ownerId: string, data: { name: string; type: AnimalType; breed: string; size: PetSize; character: PetCharacter }): Promise<Pet> {
        return this.prisma.pet.create({
            data: {
                ...data,
                ownerId,
            },
        });
    }

    async getMyPets(ownerId: string): Promise<Pet[]> {
        return this.prisma.pet.findMany({
            where: { ownerId },
        });
    }

    async deletePet(ownerId: string, petId: string): Promise<void> {
        // Ensure the pet belongs to the user
        await this.prisma.pet.deleteMany({
            where: {
                id: petId,
                ownerId,
            },
        });
    }

    async getProviderPetNote(petId: string, providerUserId: string): Promise<string | null> {
        // Find provider profile id from user id
        const provider = await this.prisma.providerProfile.findUnique({
            where: { userId: providerUserId },
        });

        if (!provider) return null;

        const note = await this.prisma.providerPetNote.findUnique({
            where: {
                petId_providerId: {
                    petId,
                    providerId: provider.id,
                },
            },
        });

        return note?.note || null;
    }

    async upsertProviderPetNote(petId: string, providerUserId: string, noteContent: string): Promise<void> {
        // Find provider profile id from user id
        const provider = await this.prisma.providerProfile.findUnique({
            where: { userId: providerUserId },
        });

        if (!provider) throw new Error('Provider profile not found');

        await this.prisma.providerPetNote.upsert({
            where: {
                petId_providerId: {
                    petId,
                    providerId: provider.id,
                },
            },
            create: {
                petId,
                providerId: provider.id,
                note: noteContent,
            },
            update: {
                note: noteContent,
            },
        });
    }
}
