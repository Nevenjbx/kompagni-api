import {
  IsOptional,
  IsEnum,
  IsInt,
  IsNumber,
  IsArray,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ValidationMode } from '@prisma/client';

export class UpdateSalonConfigDto {
  @ApiProperty({ required: false, enum: ValidationMode })
  @IsEnum(ValidationMode)
  @IsOptional()
  validationMode?: ValidationMode;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  pendingExpiryHours?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(5)
  @IsOptional()
  slotGranularityMin?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  planningHorizonDays?: number;

  @ApiProperty({ required: false, description: 'JSON array [{name, start, end}]' })
  @IsOptional()
  formationBlocks?: any;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  formationDiscount?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  cancelDeadlineHours?: number;

  @ApiProperty({ required: false, description: 'List of grooming table sizes: SMALL, LARGE, GIANT', example: ['LARGE', 'SMALL', 'SMALL'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  groomingTables?: string[];

  @ApiProperty({ required: false, description: 'Transition buffer between appointments in minutes' })
  @IsInt()
  @Min(0)
  @Max(60)
  @IsOptional()
  transitionBufferMin?: number;

  @ApiProperty({ required: false, description: 'Client duration margin percentage (e.g. 10 = +10%)' })
  @IsNumber()
  @Min(0)
  @Max(50)
  @IsOptional()
  clientDurationMarginPercent?: number;

  @ApiProperty({ required: false, description: 'Break between appointments in minutes' })
  @IsInt()
  @Min(0)
  @Max(60)
  @IsOptional()
  breakBetweenAppointmentsMin?: number;
}

