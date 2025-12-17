import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProviderDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    businessName: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    address: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    city: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    postalCode: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    @Min(-90)
    @Max(90)
    latitude?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    @Min(-180)
    @Max(180)
    longitude?: number;
}

export class UpdateProviderDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    businessName?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    address?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    city?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    postalCode?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    latitude?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    longitude?: number;
}

export class WorkingHoursDto {
    @ApiProperty({ description: 'Day of week (0=Sunday, 6=Saturday)' })
    @IsNumber()
    @Min(0)
    @Max(6)
    dayOfWeek: number;

    @ApiProperty({ example: '09:00' })
    @IsString()
    @IsNotEmpty()
    startTime: string; // "09:00"

    @ApiProperty({ example: '18:00' })
    @IsString()
    @IsNotEmpty()
    endTime: string; // "18:00"
}
