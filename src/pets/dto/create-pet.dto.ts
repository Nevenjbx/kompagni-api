import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AnimalType, PetSize, PetCharacter } from '@prisma/client';

export class CreatePetDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ enum: AnimalType })
    @IsEnum(AnimalType)
    type: AnimalType;

    @ApiProperty()
    @IsString()
    breed: string;

    @ApiProperty({ enum: PetSize })
    @IsEnum(PetSize)
    size: PetSize;

    @ApiProperty({ enum: PetCharacter })
    @IsEnum(PetCharacter)
    character: PetCharacter;
}
