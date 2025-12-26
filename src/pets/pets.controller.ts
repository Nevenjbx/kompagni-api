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
        @Body() body: { name: string; type: AnimalType; breed: string; size: PetSize; character: PetCharacter },
    ) {
        return this.petsService.createPet(req.user.id, body);
    }

    @Get()
    @ApiOperation({ summary: 'Get my pets' })
    async getMyPets(@Req() req: AuthenticatedRequest) {
        return this.petsService.getMyPets(req.user.id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a pet' })
    async deletePet(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
        return this.petsService.deletePet(req.user.id, id);
    }
}
