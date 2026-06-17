import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsDateString, IsBoolean } from 'class-validator';
import { AnimalCategory, CoatType, GroomingBehavior, SkinCondition } from '@prisma/client';

export class UpdateInternalClientDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  email?: string;
}

export class UpdateInternalPetDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  species: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  breedId: string;

  @ApiProperty({ enum: AnimalCategory })
  @IsEnum(AnimalCategory)
  category: AnimalCategory;

  @ApiProperty({ enum: CoatType })
  @IsEnum(CoatType)
  coatType: CoatType;

  @ApiProperty({ enum: GroomingBehavior })
  @IsEnum(GroomingBehavior)
  groomingBehavior: GroomingBehavior;

  @ApiProperty({ enum: SkinCondition })
  @IsEnum(SkinCondition)
  skinCondition: SkinCondition;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  weightKg?: number;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sex: string;

  @ApiProperty()
  @IsBoolean()
  isNeutered: boolean;
}
