import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PriceAdjustmentsService {
  constructor(private prisma: PrismaService) {}

  async create(salonId: string, staffId: string, data: { appointmentId: string, amount: number, reason: string }) {
    const appt = await this.prisma.appointment.findFirst({
      where: { id: data.appointmentId, salonId }
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    return this.prisma.priceAdjustment.create({
      data: {
        salonId,
        addedBy: staffId,
        appointmentId: data.appointmentId,
        amount: data.amount,
        reason: data.reason
      }
    });
  }

  async findByAppointment(salonId: string, appointmentId: string) {
    return this.prisma.priceAdjustment.findMany({
      where: { appointmentId, salonId },
      orderBy: { addedAt: 'desc' }
    });
  }

  async remove(salonId: string, id: string) {
    const existing = await this.prisma.priceAdjustment.findFirst({
      where: { id, salonId }
    });
    if (!existing) throw new NotFoundException('Price adjustment not found');

    return this.prisma.priceAdjustment.delete({ where: { id } });
  }
}
