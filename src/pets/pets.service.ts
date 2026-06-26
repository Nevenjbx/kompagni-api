import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Pet, AnimalCategory, CoatType, GroomingBehavior, SkinCondition } from '@prisma/client';
import { CreateRefinementDto } from './dto/pet.dto';

@Injectable()
export class PetsService {
    constructor(private prisma: PrismaService) { }

    async createPet(ownerId: string, data: { 
        name: string; 
        species: string;
        breedId: string;
        birthDate: Date;
        isNeutered: boolean;
        sex: string;
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
        // Ensure the pet belongs to the user and exists
        const pet = await this.prisma.pet.findFirst({
            where: {
                id: petId,
                ownerId,
            },
        });
        if (!pet) {
            throw new NotFoundException('Pet not found or not owned by user');
        }

        await this.prisma.pet.delete({
            where: {
                id: petId,
            },
        });
    }

    async updatePet(ownerId: string, petId: string, data: {
        name?: string;
        species?: string;
        breedId?: string;
        birthDate?: Date;
        isNeutered?: boolean;
        sex?: string;
        weightKg?: number;
        category?: AnimalCategory;
        coatType?: CoatType;
        groomingBehavior?: GroomingBehavior;
        skinCondition?: SkinCondition;
    }): Promise<Pet> {
        const pet = await this.prisma.pet.findFirst({
            where: { id: petId, ownerId },
        });
        if (!pet) throw new NotFoundException('Pet not found or not owned by user');

        return this.prisma.pet.update({
            where: { id: petId },
            data,
        });
    }

    // --- Refinements ---

    async addRefinement(petId: string, providerId: string, dto: CreateRefinementDto) {
        const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
        if (!pet) throw new NotFoundException('Pet not found');

        return this.prisma.animalRefinement.create({
            data: {
                animalId: petId,
                appointmentId: dto.appointmentId,
                updatedBy: providerId,
                weightKg: dto.weightKg,
                coatType: dto.coatType,
                groomingBehavior: dto.groomingBehavior,
                skinCondition: dto.skinCondition,
                toiletteurNote: dto.toiletteurNote,
            }
        });
    }

    async getRefinements(petId: string, userId: string, userRole: string) {
        const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
        if (!pet) throw new NotFoundException('Pet not found');

        // Check ownership: Only the owner, a provider, or an admin can access refinements
        if (userRole !== 'PROVIDER' && userRole !== 'ADMIN' && pet.ownerId !== userId) {
            throw new ForbiddenException('Vous n\'avez pas accès à l\'historique de cet animal');
        }

        return this.prisma.animalRefinement.findMany({
            where: { animalId: petId },
            orderBy: { createdAt: 'desc' },
        });
    }
}
