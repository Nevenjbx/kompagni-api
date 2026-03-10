import {
  IsOptional,
  IsEnum,
  IsInt,
  IsNumber,
  Min,
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
}
