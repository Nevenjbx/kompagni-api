import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Pet, AnimalCategory, CoatType, GroomingBehavior, SkinCondition } from '@prisma/client';

@Injectable()
export class PetsService {
    constructor(private prisma: PrismaService) { }

    async createPet(ownerId: string, data: { 
        name: string; 
        species: string;
        breedId: string;
        birthDate: Date;
        isNeutered: boolean;
        sex: any;
        weightKg: number;
        category: AnimalCategory;
        coatType: CoatType;
        groomingBehavior: GroomingBehavior;
        skinCondition: SkinCondition;
    }): Promise<Pet> {
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

    // --- Refinements ---

    async addRefinement(petId: string, salonId: string, data: any) {
        const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
        if (!pet) throw new NotFoundException('Pet not found');

        return this.prisma.animalRefinement.create({
            data: {
                animalId: petId,
                salonId,
                ...data, // expects weightKg, coatType, groomingBehavior, skinCondition, notes
            }
        });
    }

    async getRefinements(petId: string) {
        return this.prisma.animalRefinement.findMany({
            where: { animalId: petId },
            orderBy: { createdAt: 'desc' },
        });
    }
}
