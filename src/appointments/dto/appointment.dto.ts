import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class CreateAppointmentDto {
    @IsString()
    @IsNotEmpty()
    serviceId: string;

    @IsDateString()
    @IsNotEmpty()
    startTime: string; // ISO 8601

    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateAppointmentStatusDto {
    @IsEnum(AppointmentStatus)
    @IsNotEmpty()
    status: AppointmentStatus;
}
