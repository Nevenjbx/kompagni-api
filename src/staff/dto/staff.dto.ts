import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { StaffRole } from '@prisma/client';

export class CreateStaffDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: StaffRole })
  @IsEnum(StaffRole)
  role: StaffRole;

  @ApiProperty({ required: false, description: 'JSON array of weekly schedule' })
  @IsOptional()
  weeklySchedule?: any;

  @ApiProperty({ required: false, description: 'JSON array of leaves' })
  @IsOptional()
  leaves?: any;

  @ApiProperty({ required: false, default: 1.0 })
  @IsNumber()
  @IsOptional()
  speedIndex?: number;

  @ApiProperty({ required: false, isArray: true, type: String })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedServiceIds?: string[];
}

export class UpdateStaffDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false, enum: StaffRole })
  @IsEnum(StaffRole)
  @IsOptional()
  role?: StaffRole;

  @ApiProperty({ required: false })
  @IsOptional()
  weeklySchedule?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  leaves?: any;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  speedIndex?: number;

  @ApiProperty({ required: false, isArray: true, type: String })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedServiceIds?: string[];
}
