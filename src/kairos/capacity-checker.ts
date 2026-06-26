import { AnimalCategory } from '@prisma/client';
import { BookingData } from './availability-checker';

export interface BookingWithCategoryData extends BookingData {
   petCategory: AnimalCategory;
}

/**
 * Size hierarchy for animals and tables.
 * A table can host any animal whose size value is ≤ the table's capacity value.
 *   GIANT table (3) → can host GIANT, LARGE, SMALL, CAT, NAC
 *   LARGE table (2) → can host LARGE, SMALL, CAT, NAC
 *   SMALL table (1) → can host SMALL, CAT, NAC
 */
const TABLE_CAPACITY: Record<string, number> = {
  GIANT: 3,
  LARGE: 2,
  SMALL: 1,
};

const ANIMAL_SIZE: Record<string, number> = {
  GIANT: 3,
  LARGE: 2,
  SMALL: 1,
  CAT: 1,
  NAC: 1,
};

/**
 * Greedy sorted matching algorithm.
 *
 * Given the list of grooming tables (e.g. ["GIANT", "LARGE", "SMALL", "SMALL"])
 * and the set of animals that would be simultaneous on the requested slot,
 * determines whether every animal can be assigned to a table.
 *
 * Algorithm:
 * 1. Convert animals → numeric sizes, tables → numeric capacities.
 * 2. Sort both lists descending.
 * 3. Walk pair-by-pair: if any animal is bigger than its paired table → false.
 */
export function hasCapacity(
  animalCategory: AnimalCategory,
  start: Date,
  end: Date,
  allAppointments: BookingWithCategoryData[],
  groomingTables: string[],
): boolean {

  // Collect categories of animals already booked during [start, end)
  const overlapping = allAppointments.filter(appt =>
    appt.slotStart < end &&
    appt.slotEnd > start &&
    (appt.status === 'CONFIRMED' || appt.status === 'PENDING' || appt.status === 'IN_PROGRESS')
  );

  // Build the list of animal sizes (existing + the new request)
  const animalSizes: number[] = overlapping.map(a => ANIMAL_SIZE[a.petCategory] ?? 1);
  animalSizes.push(ANIMAL_SIZE[animalCategory] ?? 1);

  // Convert tables to capacities
  const tableCapacities: number[] = groomingTables.map(t => TABLE_CAPACITY[t] ?? 1);

  // More animals than tables → impossible
  if (animalSizes.length > tableCapacities.length) {
    return false;
  }

  // Sort both descending
  animalSizes.sort((a, b) => b - a);
  tableCapacities.sort((a, b) => b - a);

  // Greedy match: largest animal on largest table
  for (let i = 0; i < animalSizes.length; i++) {
    if (animalSizes[i] > tableCapacities[i]) {
      return false;
    }
  }

  return true;
}
