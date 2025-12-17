import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchProviderDto {
  @ApiProperty({
    required: false,
    description: 'Search query for city, zip, or business name',
  })
  @IsOptional()
  @IsString()
  q?: string; // Query for city, zip, or business name

  @ApiProperty({
    required: false,
    description: 'Filter by animal type (e.g., DOG, CAT)',
  })
  @IsOptional()
  @IsString()
  animalType?: string; // e.g. 'DOG', 'CAT'
}
