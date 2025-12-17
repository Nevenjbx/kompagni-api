import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateProviderDto {
    @IsString()
    @IsNotEmpty()
    businessName: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsNotEmpty()
    address: string;

    @IsString()
    @IsNotEmpty()
    city: string;

    @IsString()
    @IsNotEmpty()
    postalCode: string;

    @IsNumber()
    @IsOptional()
    @Min(-90)
    @Max(90)
    latitude?: number;

    @IsNumber()
    @IsOptional()
    @Min(-180)
    @Max(180)
    longitude?: number;
}

export class UpdateProviderDto {
    @IsString()
    @IsOptional()
    businessName?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    city?: string;

    @IsString()
    @IsOptional()
    postalCode?: string;

    @IsNumber()
    @IsOptional()
    latitude?: number;

    @IsNumber()
    @IsOptional()
    longitude?: number;
}

export class WorkingHoursDto {
    @IsNumber()
    @Min(0)
    @Max(6)
    dayOfWeek: number;

    @IsString()
    @IsNotEmpty()
    startTime: string; // "09:00"

    @IsString()
    @IsNotEmpty()
    endTime: string; // "18:00"
}
