import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';

export class CreateAppointmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  animalId: string;


  @ApiProperty({ description: 'Lock token from slot reservation' })
  @IsString()
  @IsNotEmpty()
  lockToken: string;

  // Slot info (from user selection)
  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  slotStart: string;

  @ApiProperty()
  @IsNotEmpty()
  quoteResult: any; // Using any for DTO validation simplification, it maps to QuoteResult from engine

  // Layer 3 fields
  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  hasKnotsToday: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  precautions?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientFreeNote?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  staffId: string;
}

export class UpdateAppointmentStatusDto {
  @ApiProperty({ enum: AppointmentStatus })
  @IsEnum(AppointmentStatus)
  @IsNotEmpty()
  status: AppointmentStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}

export class GetSlotsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  animalId: string;

}

export class LockSlotDto {
  @ApiProperty({ description: 'Slot start time' })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  salonId: string;
}
