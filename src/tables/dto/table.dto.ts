import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TableCategory } from '@prisma/client';

export class CreateTableDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: TableCategory })
  @IsEnum(TableCategory)
  category: TableCategory;
}

export class UpdateTableDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false, enum: TableCategory })
  @IsEnum(TableCategory)
  @IsOptional()
  category?: TableCategory;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
