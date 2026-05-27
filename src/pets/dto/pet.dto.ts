import { IsString, IsNotEmpty, IsBoolean, IsNumber, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { AnimalCategory, CoatType, GroomingBehavior, SkinCondition } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePetDto {
  @ApiProperty({ example: 'Fidji' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'dog' })
  @IsString()
  @IsNotEmpty()
  species: string;

  @ApiProperty({ example: 'Golden Retriever' })
  @IsString()
  @IsNotEmpty()
  breedId: string;

  @ApiProperty({ example: '2021-10-12T00:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  birthDate: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  @IsOptional()
  isNeutered?: boolean;

  @ApiProperty({ example: 'MALE' })
  @IsString()
  @IsNotEmpty()
  sex: string;

  @ApiProperty({ example: 12.5 })
  @IsNumber()
  @IsNotEmpty()
  weightKg: number;

  @ApiProperty({ enum: AnimalCategory, example: AnimalCategory.SMALL })
  @IsEnum(AnimalCategory)
  category: AnimalCategory;

  @ApiProperty({ enum: CoatType, example: CoatType.SHORT })
  @IsEnum(CoatType)
  coatType: CoatType;

  @ApiProperty({ enum: GroomingBehavior, example: GroomingBehavior.EASY })
  @IsEnum(GroomingBehavior)
  groomingBehavior: GroomingBehavior;

  @ApiProperty({ enum: SkinCondition, example: SkinCondition.NORMAL })
  @IsEnum(SkinCondition)
  skinCondition: SkinCondition;
}

export class UpdatePetDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  species?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  breedId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isNeutered?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sex?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  weightKg?: number;

  @ApiPropertyOptional({ enum: AnimalCategory })
  @IsEnum(AnimalCategory)
  @IsOptional()
  category?: AnimalCategory;

  @ApiPropertyOptional({ enum: CoatType })
  @IsEnum(CoatType)
  @IsOptional()
  coatType?: CoatType;

  @ApiPropertyOptional({ enum: GroomingBehavior })
  @IsEnum(GroomingBehavior)
  @IsOptional()
  groomingBehavior?: GroomingBehavior;

  @ApiPropertyOptional({ enum: SkinCondition })
  @IsEnum(SkinCondition)
  @IsOptional()
  skinCondition?: SkinCondition;
}
