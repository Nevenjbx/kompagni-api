import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { AnimalType } from '@prisma/client';

export class CreateServiceDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsNumber()
    @Min(0)
    duration: number; // minutes

    @IsNumber()
    @Min(0)
    price: number;

    @IsEnum(AnimalType)
    animalType: AnimalType;
}

export class UpdateServiceDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsNumber()
    @IsOptional()
    @Min(0)
    duration?: number;

    @IsNumber()
    @IsOptional()
    @Min(0)
    price?: number;

    @IsEnum(AnimalType)
    @IsOptional()
    animalType?: AnimalType;
}
