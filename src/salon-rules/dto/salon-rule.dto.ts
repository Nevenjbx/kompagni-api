import { IsString, IsOptional, IsBoolean, IsNumber, IsIn } from 'class-validator';

export class CreateSalonRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  priority?: number;

  // Condition
  @IsString()
  conditionField: string;

  @IsString()
  @IsIn(['==', '!=', '>', '<', '>=', '<='])
  conditionOperator: string;

  @IsString()
  conditionValue: string;

  // Effect
  @IsString()
  @IsIn(['DURATION', 'PRICE', 'SCHEDULING'])
  effectType: string;

  @IsString()
  @IsIn(['ADD', 'MULTIPLY', 'BLOCK_RESOURCE'])
  effectAction: string;

  @IsNumber()
  effectValue: number;
}

export class UpdateSalonRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsString()
  conditionField?: string;

  @IsOptional()
  @IsString()
  @IsIn(['==', '!=', '>', '<', '>=', '<='])
  conditionOperator?: string;

  @IsOptional()
  @IsString()
  conditionValue?: string;

  @IsOptional()
  @IsString()
  @IsIn(['DURATION', 'PRICE', 'SCHEDULING'])
  effectType?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ADD', 'MULTIPLY', 'BLOCK_RESOURCE'])
  effectAction?: string;

  @IsOptional()
  @IsNumber()
  effectValue?: number;
}

export class ReorderRulesDto {
  @IsString({ each: true })
  orderedIds: string[];
}
