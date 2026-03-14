import { getActiveModifiers, getStaffSpecificModifiers } from './modifier-evaluator';
import { AnimalData, ModifierRuleData, StaffData } from './types';
import { AnimalCategory, CoatType, GroomingBehavior, SkinCondition, StaffRole } from '@prisma/client';

describe('Modifier Evaluator', () => {
  const rules: ModifierRuleData[] = [
    { id: 'm1', salonId: 's1', triggerType: 'HAS_KNOTS', addedMinutes: 15, priceEffectFlat: 10, priceEffectPercent: 0, isActive: true },
    { id: 'm2', salonId: 's1', triggerType: 'BEHAVIOR_BAD', addedMinutes: 15, priceEffectFlat: 15, priceEffectPercent: 0, isActive: true },
    { id: 'm3', salonId: 's1', triggerType: 'FIRST_VISIT', addedMinutes: 0, priceEffectFlat: 0, priceEffectPercent: 0, isActive: true },
    { id: 'm4', salonId: 's1', triggerType: 'INTERVAL_LONG', addedMinutes: 0, priceEffectFlat: 0, priceEffectPercent: 0, isActive: true },
    { id: 'm5', salonId: 's1', triggerType: 'IS_APPRENTICE', addedMinutes: 0, priceEffectFlat: 0, priceEffectPercent: -0.2, isActive: true },
  ];

  const baseAnimal: AnimalData = {
    id: 'a1', species: 'dog', birthDate: new Date('2020-01-01'), isNeutered: true, weightKg: 10,
    category: AnimalCategory.SMALL, coatType: CoatType.SHORT, groomingBehavior: GroomingBehavior.EASY,
    skinCondition: SkinCondition.NORMAL, lastGroomedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  };

  const staff: StaffData = {
    id: 's1', salonId: 's1', name: 'John', role: StaffRole.APPRENTICE, speedIndex: 1.3, allowedServiceIds: []
  };

  it('should trigger HAS_KNOTS if note says so', () => {
    const act = getActiveModifiers(rules, baseAnimal, { hasKnotsToday: true });
    expect(act.map(r => r.triggerType)).toEqual(['HAS_KNOTS']);
  });

  it('should trigger BEHAVIOR_BAD if score >= 4', () => {
    const animal = { ...baseAnimal, groomingBehavior: GroomingBehavior.DIFFICULT }; // score 4
    const act = getActiveModifiers(rules, animal);
    expect(act.map(r => r.triggerType)).toEqual(['BEHAVIOR_BAD']);
  });

  it('should trigger FIRST_VISIT if no lastGroomedAt', () => {
    const animal = { ...baseAnimal, lastGroomedAt: null };
    const act = getActiveModifiers(rules, animal);
    expect(act.map(r => r.triggerType)).toEqual(['FIRST_VISIT']);
  });

  it('should combine multiple general triggers', () => {
    const animal = { ...baseAnimal, lastGroomedAt: null, groomingBehavior: GroomingBehavior.DIFFICULT };
    const act = getActiveModifiers(rules, animal, { hasKnotsToday: true });
    expect(act.map(r => r.triggerType)).toEqual(['HAS_KNOTS', 'BEHAVIOR_BAD', 'FIRST_VISIT']);
  });

  it('should trigger IS_APPRENTICE for staff evaluator', () => {
    const act = getStaffSpecificModifiers(rules, staff);
    expect(act.map(r => r.triggerType)).toEqual(['IS_APPRENTICE']);
  });
});
