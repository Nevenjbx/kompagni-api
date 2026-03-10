import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus, OfferType } from '@prisma/client';

export class CreateAppointmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  animalId: string;

  @ApiProperty({ enum: OfferType })
  @IsEnum(OfferType)
  offerType: OfferType;

  @ApiProperty({ description: 'Lock token from slot reservation' })
  @IsString()
  @IsNotEmpty()
  lockToken: string;

  // Slot info (populated from the locked slot)
  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  slotStart: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  slotEnd: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tableId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  durationMinutes?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  formationBlock?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
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

  @ApiProperty({ enum: OfferType })
  @IsEnum(OfferType)
  offerType: OfferType;
}

export class LockSlotDto {
  @ApiProperty({ description: 'Slot key: tableId_date_startTime' })
  @IsString()
  @IsNotEmpty()
  slotKey: string;
}
