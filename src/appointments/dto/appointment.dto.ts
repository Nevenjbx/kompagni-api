import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  ValidateNested,
  IsNumber,
  IsArray,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class QuoteResultDto {
  @ApiProperty()
  @IsNumber()
  theoreticalDurationMinutes: number;

  @ApiProperty()
  @IsNumber()
  actualDurationMinutes: number;

  @ApiProperty()
  @IsNumber()
  clientDurationMax: number;

  @ApiProperty()
  @IsNumber()
  tableDurationMinutes: number;

  @ApiProperty()
  @IsNumber()
  estimatedPrice: number;

  @ApiProperty({ enum: ['exact', 'estimate'] })
  @IsEnum(['exact', 'estimate'])
  priceDisplayMode: 'exact' | 'estimate';

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  priceDisplayDisclaimer?: string | null;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  appliedModifiers: string[];
}

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

  @ApiProperty({ type: QuoteResultDto })
  @ValidateNested()
  @Type(() => QuoteResultDto)
  @IsNotEmpty()
  quoteResult: QuoteResultDto;

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

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  offerType?: string;
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

export class UnlockSlotDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lockToken: string;
}

export class GetStatsDto {
  @ApiProperty({ enum: ['today', 'week', 'month'], description: 'Période pour les statistiques' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['today', 'week', 'month'])
  period: 'today' | 'week' | 'month';
}

export class CreateManualAppointmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  petId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientFirstName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientLastName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientEmail?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientPhoneNumber?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  petName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  petCategory?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  petNotes?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  slotStart: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  slotEnd: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  manualPrice?: number;
}


