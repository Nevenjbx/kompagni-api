import { AnimalCategory, AppointmentStatus } from '@prisma/client';
import { BookingData } from './availability-checker';

export interface BookingWithCategoryData extends BookingData {
   petCategory: AnimalCategory;
}

export function hasCapacity(
  category: AnimalCategory,
  start: Date, 
  end: Date,
  allAppointments: BookingWithCategoryData[],
  concurrentLimits: Record<string, number>,
): boolean {
  
  const concurrentCount = allAppointments.filter(appt => 
    appt.petCategory === category &&
    appt.slotStart < end &&
    appt.slotEnd > start &&
    (appt.status === 'CONFIRMED' || appt.status === 'PENDING' || appt.status === 'IN_PROGRESS')
  ).length;

  // If limits not defined for this category, assume infinite capacity (or 1)
  // Actually, plan says concurrentLimits is a JSON like {"SMALL":2,"LARGE":1}
  const limit = concurrentLimits[category] ?? 1;

  return concurrentCount < limit;
}
