import { AnimalData, AnimalRefinementData } from './types';

/**
 * Returns a merged AnimalData object, using properties from the latest refinement 
 * if they exist, otherwise picking them from the base animal.
 */
export function resolveAnimal(
  animal: AnimalData,
  latestRefinement?: AnimalRefinementData | null,
): AnimalData {
  if (!latestRefinement) {
    return animal;
  }

  return {
    ...animal,
    weightKg: latestRefinement.weightKg ?? animal.weightKg,
    coatType: latestRefinement.coatType ?? animal.coatType,
    groomingBehavior: latestRefinement.groomingBehavior ?? animal.groomingBehavior,
    skinCondition: latestRefinement.skinCondition ?? animal.skinCondition,
  };
}
