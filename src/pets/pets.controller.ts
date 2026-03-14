import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { PetsService } from './pets.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { AnimalCategory, CoatType, GroomingBehavior, SkinCondition } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Pets')
@Controller('pets')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class PetsController {
    constructor(private petsService: PetsService) { }

    @Post()
    @ApiOperation({ summary: 'Add a new pet' })
    async addPet(
        @Req() req: AuthenticatedRequest,
        @Body() body: any, // Basic typing, can be improved with a DTO
    ) {
        // We accept the new 3-layer model fields
        const normalizedData = {
            name: body.name,
            species: body.species,
            breedId: body.breedId,
            birthDate: body.birthDate ? new Date(body.birthDate) : new Date(),
            isNeutered: body.isNeutered ?? false,
            sex: body.sex || 'UNKNOWN',
            weightKg: body.weightKg,
            category: body.category as AnimalCategory,
            coatType: body.coatType as CoatType,
            groomingBehavior: body.groomingBehavior as GroomingBehavior,
            skinCondition: body.skinCondition as SkinCondition,
        };
        try {
            return await this.petsService.createPet(req.user.id, normalizedData);
        } catch (error) {
            console.error('Error creating pet in Prisma:', error);
            throw error;
        }
    }

    @Get()
    @ApiOperation({ summary: 'Get my pets' })
    async getMyPets(@Req() req: AuthenticatedRequest) {
        return this.petsService.getMyPets(req.user.id);
    }

    @Get('user/:userId')
    @ApiOperation({ summary: 'Get pets of a specific user' })
    async getUserPets(@Param('userId') userId: string) {
        return this.petsService.getMyPets(userId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a pet' })
    async deletePet(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
        return this.petsService.deletePet(req.user.id, id);
    }

    // --- Animal Refinements ---

    @Post(':id/refinements')
    @ApiOperation({ summary: 'Add a refinement for a pet' })
    async addRefinement(
        @Req() req: AuthenticatedRequest,
        @Param('id') id: string,
        @Body() body: any,
    ) {
        const salonId = body.salonId || req.user.id; // Just fallback for testing
        return this.petsService.addRefinement(id, salonId, body);
    }

    @Get(':id/refinements')
    @ApiOperation({ summary: 'Get refinement history for a pet' })
    async getRefinements(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
        return this.petsService.getRefinements(id);
    }
}
