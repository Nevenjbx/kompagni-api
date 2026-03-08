import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWaitlistLeadDto } from './dto/create-waitlist-lead.dto';

@Injectable()
export class WaitlistService {
    constructor(private prisma: PrismaService) { }

    async create(createWaitlistLeadDto: CreateWaitlistLeadDto) {
        try {
            const existingLead = await this.prisma.waitlistLead.findUnique({
                where: { email: createWaitlistLeadDto.email },
            });

            if (existingLead) {
                throw new ConflictException('Email already registered');
            }

            const newLead = await this.prisma.waitlistLead.create({
                data: {
                    email: createWaitlistLeadDto.email,
                    profile: createWaitlistLeadDto.profile,
                    city: createWaitlistLeadDto.city,
                },
            });

            return {
                message: 'Successfully joined the waitlist',
                lead: newLead,
            };
        } catch (error) {
            if (error instanceof ConflictException) {
                throw error;
            }
            throw new InternalServerErrorException('An error occurred while joining the waitlist');
        }
    }
}
