import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { CreateWaitlistLeadDto } from './dto/create-waitlist-lead.dto';

@Controller('waitlist')
export class WaitlistController {
    constructor(private readonly waitlistService: WaitlistService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() createWaitlistLeadDto: CreateWaitlistLeadDto) {
        return this.waitlistService.create(createWaitlistLeadDto);
    }
}
