import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { PetsService } from './pets.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { PetSize, PetCharacter, AnimalType } from '@prisma/client';
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
        @Body() body: { name: string; type: string; breed: string; size: string; character: string },
    ) {
        // Convert lowercase enum values from frontend to uppercase for Prisma
        const normalizedData = {
            name: body.name,
            type: body.type.toUpperCase() as AnimalType,
            breed: body.breed,
            size: body.size.toUpperCase() as PetSize,
            character: body.character.toUpperCase() as PetCharacter,
        };
        return this.petsService.createPet(req.user.id, normalizedData);
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

    @Get(':id/note')
    @ApiOperation({ summary: 'Get provider note for a pet' })
    async getPetNote(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
        const note = await this.petsService.getProviderPetNote(id, req.user.id);
        return { note };
    }

    @Post(':id/note')
    @ApiOperation({ summary: 'Update provider note for a pet' })
    async updatePetNote(
        @Req() req: AuthenticatedRequest,
        @Param('id') id: string,
        @Body() body: { note: string },
    ) {
        await this.petsService.upsertProviderPetNote(id, req.user.id, body.note);
        return { success: true };
    }
}
