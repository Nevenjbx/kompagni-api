import { computeDifficultyScore } from './difficulty-score';
import { AnimalData, AppointmentNoteData } from './types';
import { AnimalCategory, CoatType, GroomingBehavior, SkinCondition } from '@prisma/client';

describe('Difficulty Score', () => {
  const baseAnimal: AnimalData = {
    id: 'a1',
    species: 'dog',
    birthDate: new Date('2020-01-01'), // ~6 years old
    isNeutered: true,
    weightKg: 10,
    category: AnimalCategory.SMALL,
    coatType: CoatType.SHORT,
    groomingBehavior: GroomingBehavior.EASY,
    skinCondition: SkinCondition.NORMAL,
    lastGroomedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
  };

  it('should return 0 for all easy defaults', () => {
    expect(computeDifficultyScore(baseAnimal)).toBe(0);
  });

  it('should trigger BEHAVIOR_BAD threshold exactly at 4', () => {
    const animal = {
      ...baseAnimal,
      groomingBehavior: GroomingBehavior.NERVOUS, // +2
      coatType: CoatType.DOUBLE_COAT, // +2
    };
    expect(computeDifficultyScore(animal)).toBe(4);
  });

  it('should cap out at 10 for max difficulty', () => {
    const difficult: AnimalData = {
      ...baseAnimal,
      groomingBehavior: GroomingBehavior.DIFFICULT, // +4
      coatType: CoatType.MATTED, // +3
      skinCondition: SkinCondition.PROBLEM, // +1
      birthDate: new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000), // 2 months old (+1)
      isNeutered: false, // 2 months old not neutered -> +0 because < 6 months old
      lastGroomedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // > 84 days (+1)
    };
    const note: AppointmentNoteData = { hasKnotsToday: true }; // +1
    // Total = 4 + 3 + 1 + 1 + 0 + 1 + 1 = 11 -> capped to 10
    expect(computeDifficultyScore(difficult, note)).toBe(10);
  });
});
