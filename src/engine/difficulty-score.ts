import { AnimalData, AppointmentNoteData } from './types';

/**
 * Implements the scoring table from TDD §3.3d.
 * Pure function. Returns a score from 0 to 10 (capped).
 */
export function computeDifficultyScore(
  animal: AnimalData,
  note?: AppointmentNoteData | null,
): number {
  let score = 0;

  // 1. Behavior
  switch (animal.groomingBehavior) {
    case 'NERVOUS':
      score += 2;
      break;
    case 'DIFFICULT':
      score += 4;
      break;
  }

  // 2. Coat Type
  switch (animal.coatType) {
    case 'LONG':
    case 'CURLY':
      score += 1;
      break;
    case 'DOUBLE_COAT':
      score += 2;
      break;
    case 'MATTED':
      score += 3;
      break;
  }

  // 3. Skin
  if (animal.skinCondition === 'PROBLEM' || animal.skinCondition === 'SENSITIVE') {
    score += 1;
  }

  // 4. Age (assuming birthDate)
  const ageMonths = calculateAgeInMonths(animal.birthDate);
  if (ageMonths < 6 || ageMonths > 144) { // <6 months or >12 years
    score += 1;
  }

  // 5. Hormones
  if (!animal.isNeutered && ageMonths >= 6) {
    score += 1;
  }

  // 6. Knots (from note)
  if (note?.hasKnotsToday) {
    score += 1;
  }

  // 7. Interval
  if (!animal.lastGroomedAt) {
    // First visit could be considered long interval
    score += 1;
  } else {
    const daysSince = getDaysPassed(animal.lastGroomedAt);
    if (daysSince > 84) { // > 12 weeks
      score += 1;
    }
  }

  return Math.min(score, 10);
}

function calculateAgeInMonths(birthDate: Date): number {
  const now = new Date();
  const months = (now.getFullYear() - birthDate.getFullYear()) * 12;
  return months - birthDate.getMonth() + now.getMonth();
}

function getDaysPassed(date: Date): number {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
