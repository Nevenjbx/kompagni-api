import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AnimalType } from '@prisma/client';

export class CreateServiceDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ example: 30 })
    @IsNumber()
    @Min(0)
    duration: number; // minutes

    @ApiProperty({ example: 50.0 })
    @IsNumber()
    @Min(0)
    price: number;

    @ApiProperty({ enum: AnimalType })
    @IsEnum(AnimalType)
    animalType: AnimalType;
}

export class UpdateServiceDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    @Min(0)
    duration?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    @Min(0)
    price?: number;

    @ApiProperty({ required: false, enum: AnimalType })
    @IsEnum(AnimalType)
    @IsOptional()
    animalType?: AnimalType;
}
