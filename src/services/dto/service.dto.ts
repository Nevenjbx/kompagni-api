import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AnimalType, OfferType } from '@prisma/client';

export class CreateServiceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: AnimalType })
  @IsEnum(AnimalType)
  animalType: AnimalType;

  @ApiProperty({ enum: OfferType, isArray: true, default: ['PRO'] })
  @IsArray()
  @IsOptional()
  availableModes?: OfferType[];

  @ApiProperty({ example: 60 })
  @IsInt()
  @Min(5)
  defaultDurationPro: number;

  @ApiProperty({ required: false, example: 180 })
  @IsInt()
  @Min(5)
  @IsOptional()
  defaultDurationForm?: number;

  @ApiProperty({
    description: 'Tranches de prix JSON: [{maxWeightKg, price}]',
    example: [{ maxWeightKg: 7, price: 40 }, { maxWeightKg: null, price: 60 }],
  })
  priceTiers: any;
}

export class UpdateServiceDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false, enum: AnimalType })
  @IsEnum(AnimalType)
  @IsOptional()
  animalType?: AnimalType;

  @ApiProperty({ required: false })
  @IsArray()
  @IsOptional()
  availableModes?: OfferType[];

  @ApiProperty({ required: false })
  @IsInt()
  @Min(5)
  @IsOptional()
  defaultDurationPro?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(5)
  @IsOptional()
  defaultDurationForm?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  priceTiers?: any;
}
