import {
  resolveField,
  matchesCondition,
  evaluateRules,
  applyDurationEffects,
  applyPriceEffects,
  RuleContext,
  SalonRuleData,
} from './rule-evaluator';

describe('Rule Evaluator', () => {
  const baseContext: RuleContext = {
    animal: {
      weightKg: 25,
      category: 'LARGE',
      coatType: 'LONG',
      groomingBehavior: 'NERVOUS',
      skinCondition: 'NORMAL',
      difficultyScore: 5,
      lastGroomedAt: new Date('2026-01-01'),
      daysSinceGroom: 90,
    },
    staff: {
      role: 'APPRENTICE',
      speedIndex: 1.3,
    },
    appointment: {
      hasKnots: true,
      isFirstVisit: false,
    },
    client: {
      visitCount: 3,
    },
  };

  describe('resolveField', () => {
    it('should resolve dotted path from context', () => {
      expect(resolveField('animal.weightKg', baseContext)).toBe(25);
      expect(resolveField('staff.role', baseContext)).toBe('APPRENTICE');
      expect(resolveField('appointment.hasKnots', baseContext)).toBe(true);
      expect(resolveField('client.visitCount', baseContext)).toBe(3);
    });

    it('should return undefined for invalid paths', () => {
      expect(resolveField('unknown.field', baseContext)).toBeUndefined();
      expect(resolveField('animal.nonExistent', baseContext)).toBeUndefined();
    });
  });

  describe('matchesCondition', () => {
    it('should handle boolean comparisons', () => {
      expect(matchesCondition(true, '==', 'true')).toBe(true);
      expect(matchesCondition(false, '==', 'true')).toBe(false);
      expect(matchesCondition(true, '!=', 'true')).toBe(false);
    });

    it('should handle numeric comparisons', () => {
      expect(matchesCondition(25, '>', '20')).toBe(true);
      expect(matchesCondition(25, '<', '20')).toBe(false);
      expect(matchesCondition(25, '>=', '25')).toBe(true);
      expect(matchesCondition(25, '<=', '25')).toBe(true);
      expect(matchesCondition(25, '==', '25')).toBe(true);
      expect(matchesCondition(25, '!=', '25')).toBe(false);
    });

    it('should handle string/enum comparisons (case-insensitive)', () => {
      expect(matchesCondition('APPRENTICE', '==', 'APPRENTICE')).toBe(true);
      expect(matchesCondition('apprentice', '==', 'APPRENTICE')).toBe(true);
      expect(matchesCondition('PROFESSIONAL', '!=', 'APPRENTICE')).toBe(true);
    });

    it('should return false for null/undefined values', () => {
      expect(matchesCondition(null, '==', 'true')).toBe(false);
      expect(matchesCondition(undefined, '>', '5')).toBe(false);
    });
  });

  describe('evaluateRules', () => {
    const rules: SalonRuleData[] = [
      {
        id: '1', salonId: 's1', name: 'Supplément nœuds',
        isActive: true, priority: 0,
        conditionField: 'appointment.hasKnots', conditionOperator: '==', conditionValue: 'true',
        effectType: 'DURATION', effectAction: 'ADD', effectValue: 30,
      },
      {
        id: '2', salonId: 's1', name: 'Comportement difficile',
        isActive: true, priority: 1,
        conditionField: 'animal.difficultyScore', conditionOperator: '>=', conditionValue: '4',
        effectType: 'DURATION', effectAction: 'ADD', effectValue: 20,
      },
      {
        id: '3', salonId: 's1', name: 'Réduction apprenti',
        isActive: true, priority: 0,
        conditionField: 'staff.role', conditionOperator: '==', conditionValue: 'APPRENTICE',
        effectType: 'PRICE', effectAction: 'ADD', effectValue: -10,
      },
      {
        id: '4', salonId: 's1', name: 'Règle désactivée',
        isActive: false, priority: 0,
        conditionField: 'animal.weightKg', conditionOperator: '>', conditionValue: '10',
        effectType: 'DURATION', effectAction: 'ADD', effectValue: 999,
      },
    ];

    it('should return matching active rules', () => {
      const effects = evaluateRules(rules, baseContext);
      expect(effects).toHaveLength(3); // 3 active rules match
      expect(effects.map(e => e.ruleName)).toEqual([
        'Supplément nœuds',
        'Comportement difficile',
        'Réduction apprenti',
      ]);
    });

    it('should filter by effect type', () => {
      const durationEffects = evaluateRules(rules, baseContext, 'DURATION');
      expect(durationEffects).toHaveLength(2);
      expect(durationEffects.every(e => e.type === 'DURATION')).toBe(true);

      const priceEffects = evaluateRules(rules, baseContext, 'PRICE');
      expect(priceEffects).toHaveLength(1);
      expect(priceEffects[0].ruleName).toBe('Réduction apprenti');
    });

    it('should skip inactive rules', () => {
      const effects = evaluateRules(rules, baseContext);
      expect(effects.find(e => e.ruleName === 'Règle désactivée')).toBeUndefined();
    });

    it('should skip non-matching rules', () => {
      const noKnotsContext = {
        ...baseContext,
        appointment: { ...baseContext.appointment, hasKnots: false },
        animal: { ...baseContext.animal, difficultyScore: 1 },
        staff: { ...baseContext.staff, role: 'PROFESSIONAL' },
      };
      const effects = evaluateRules(rules, noKnotsContext);
      expect(effects).toHaveLength(0);
    });
  });

  describe('applyDurationEffects', () => {
    it('should apply ADD effects', () => {
      const effects = [
        { type: 'DURATION' as const, action: 'ADD' as const, value: 30, ruleName: 'test' },
        { type: 'DURATION' as const, action: 'ADD' as const, value: 20, ruleName: 'test2' },
      ];
      expect(applyDurationEffects(60, effects)).toBe(110); // 60 + 30 + 20
    });

    it('should apply MULTIPLY effects', () => {
      const effects = [
        { type: 'DURATION' as const, action: 'MULTIPLY' as const, value: 1.5, ruleName: 'test' },
      ];
      expect(applyDurationEffects(60, effects)).toBe(90); // 60 × 1.5
    });

    it('should apply mixed effects in order', () => {
      const effects = [
        { type: 'DURATION' as const, action: 'ADD' as const, value: 30, ruleName: 'add' },
        { type: 'DURATION' as const, action: 'MULTIPLY' as const, value: 1.5, ruleName: 'multiply' },
      ];
      expect(applyDurationEffects(60, effects)).toBe(135); // (60 + 30) × 1.5
    });

    it('should never return negative duration', () => {
      const effects = [
        { type: 'DURATION' as const, action: 'ADD' as const, value: -100, ruleName: 'test' },
      ];
      expect(applyDurationEffects(60, effects)).toBe(0);
    });
  });

  describe('applyPriceEffects', () => {
    it('should apply ADD effects', () => {
      const effects = [
        { type: 'PRICE' as const, action: 'ADD' as const, value: -10, ruleName: 'discount' },
      ];
      expect(applyPriceEffects(50, effects)).toBe(40);
    });

    it('should apply MULTIPLY effects', () => {
      const effects = [
        { type: 'PRICE' as const, action: 'MULTIPLY' as const, value: 0.9, ruleName: '10% off' },
      ];
      expect(applyPriceEffects(50, effects)).toBe(45);
    });

    it('should apply effects in order (order matters)', () => {
      // -10% then +5€
      const effects1 = [
        { type: 'PRICE' as const, action: 'MULTIPLY' as const, value: 0.9, ruleName: '10% off' },
        { type: 'PRICE' as const, action: 'ADD' as const, value: 5, ruleName: 'weekend' },
      ];
      expect(applyPriceEffects(100, effects1)).toBe(95); // (100 × 0.9) + 5 = 95

      // +5€ then -10%
      const effects2 = [
        { type: 'PRICE' as const, action: 'ADD' as const, value: 5, ruleName: 'weekend' },
        { type: 'PRICE' as const, action: 'MULTIPLY' as const, value: 0.9, ruleName: '10% off' },
      ];
      expect(applyPriceEffects(100, effects2)).toBe(94.5); // (100 + 5) × 0.9 = 94.5
    });
  });
});
