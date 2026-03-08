import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateWaitlistLeadDto {
    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    profile: string;

    @IsString()
    @IsOptional()
    city?: string;
}
