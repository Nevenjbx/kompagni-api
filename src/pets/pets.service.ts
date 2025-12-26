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
}
