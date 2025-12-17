import { IsOptional, IsString } from 'class-validator';

export class SearchProviderDto {
    @IsOptional()
    @IsString()
    q?: string; // Query for city, zip, or business name

    @IsOptional()
    @IsString()
    animalType?: string; // e.g. 'DOG', 'CAT'
}
