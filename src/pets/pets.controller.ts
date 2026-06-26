import { Controller, Get, Post, Delete, Patch, Body, Param, Req, UseGuards, ForbiddenException, Logger } from '@nestjs/common';
import { PetsService } from './pets.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { AnimalCategory, CoatType, GroomingBehavior, SkinCondition } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreatePetDto, UpdatePetDto, CreateRefinementDto } from './dto/pet.dto';

@ApiTags('Pets')
@Controller('pets')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class PetsController {
    private readonly logger = new Logger(PetsController.name);

    constructor(private petsService: PetsService) { }

    @Post()
    @ApiOperation({ summary: 'Add a new pet' })
    async addPet(
        @Req() req: AuthenticatedRequest,
        @Body() dto: CreatePetDto,
    ) {
        const normalizedData = {
            name: dto.name,
            species: dto.species,
            breedId: dto.breedId,
            birthDate: new Date(dto.birthDate),
            isNeutered: dto.isNeutered ?? false,
            sex: dto.sex,
            weightKg: dto.weightKg,
            category: dto.category,
            coatType: dto.coatType,
            groomingBehavior: dto.groomingBehavior,
            skinCondition: dto.skinCondition,
        };
        try {
            return await this.petsService.createPet(req.user.id, normalizedData);
        } catch (error) {
            this.logger.error('Error creating pet in Prisma:', error);
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
    async getUserPets(
        @Req() req: AuthenticatedRequest,
        @Param('userId') userId: string,
    ) {
        if (req.user.role === 'CLIENT' && req.user.id !== userId) {
            throw new ForbiddenException('Non autorisé à lister les animaux de cet utilisateur');
        }
        return this.petsService.getMyPets(userId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a pet' })
    async deletePet(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
        return this.petsService.deletePet(req.user.id, id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update an existing pet' })
    async updatePet(
        @Req() req: AuthenticatedRequest,
        @Param('id') id: string,
        @Body() dto: UpdatePetDto,
    ) {
        const normalizedData: any = {};
        if (dto.name !== undefined) normalizedData.name = dto.name;
        if (dto.species !== undefined) normalizedData.species = dto.species;
        if (dto.breedId !== undefined) normalizedData.breedId = dto.breedId;
        if (dto.birthDate !== undefined) normalizedData.birthDate = new Date(dto.birthDate);
        if (dto.isNeutered !== undefined) normalizedData.isNeutered = dto.isNeutered;
        if (dto.sex !== undefined) normalizedData.sex = dto.sex;
        if (dto.weightKg !== undefined) normalizedData.weightKg = dto.weightKg;
        if (dto.category !== undefined) normalizedData.category = dto.category;
        if (dto.coatType !== undefined) normalizedData.coatType = dto.coatType;
        if (dto.groomingBehavior !== undefined) normalizedData.groomingBehavior = dto.groomingBehavior;
        if (dto.skinCondition !== undefined) normalizedData.skinCondition = dto.skinCondition;

        try {
            return await this.petsService.updatePet(req.user.id, id, normalizedData);
        } catch (error) {
            this.logger.error('Error updating pet in Prisma:', error);
            throw error;
        }
    }

    // --- Animal Refinements ---

    @Post(':id/refinements')
    @ApiOperation({ summary: 'Add a refinement for a pet' })
    async addRefinement(
        @Req() req: AuthenticatedRequest,
        @Param('id') id: string,
        @Body() body: CreateRefinementDto,
    ) {
        return this.petsService.addRefinement(id, req.user.id, body);
    }

    @Get(':id/refinements')
    @ApiOperation({ summary: 'Get refinement history for a pet' })
    async getRefinements(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
        return this.petsService.getRefinements(id, req.user.id, req.user.role);
    }
}
