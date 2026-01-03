import { IsInt, IsString, Matches, Min, Max, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/; // HH:mm

export class CreateWorkingHoursDto {
    @ApiProperty({ example: 1, description: 'Day of week (0=Sunday, 6=Saturday)' })
    @IsInt()
    @Min(0)
    @Max(6)
    dayOfWeek: number;

    @ApiProperty({ example: '09:00', pattern: 'HH:mm' })
    @IsString()
    @Matches(TIME_REGEX, { message: 'startTime must be in HH:mm format' })
    startTime: string;

    @ApiProperty({ example: '18:00', pattern: 'HH:mm' })
    @IsString()
    @Matches(TIME_REGEX, { message: 'endTime must be in HH:mm format' })
    endTime: string;

    @ApiPropertyOptional({ example: '12:00', pattern: 'HH:mm' })
    @IsOptional()
    @IsString()
    @Matches(TIME_REGEX, { message: 'breakStartTime must be in HH:mm format' })
    breakStartTime?: string;

    @ApiPropertyOptional({ example: '13:00', pattern: 'HH:mm' })
    @IsOptional()
    @IsString()
    @Matches(TIME_REGEX, { message: 'breakEndTime must be in HH:mm format' })
    breakEndTime?: string;

    // Note: Schema doesn't have isClosed but UI might send it. It's implicit if no entry exists or if manually handled.
    // Ideally, if isClosed is true, we might skip time validation, but let's stick to Schema.
}
