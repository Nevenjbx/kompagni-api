import { findBaseRule, buildQuote, computeTheoreticalDuration } from './duration-engine';
import { BaseRuleData, ModifierRuleData, StaffData } from './types';
import { StaffRole } from '@prisma/client';

describe('Duration Engine - Scenario tests', () => {
  it('Scenario A: Terre-Neuve 35kg, TIME_BASED, apprentice', () => {
    // TDD §9:
    // Terre-Neuve (Giant), 35kg. Service = Grooming.
    // TIME_BASED mode: 60€/h -> 1€/min. Base duration = 120min.
    // Apprentice: +0 min, -20% price. Speed = 1.3
    const baseRule: BaseRuleData = {
      id: 'r1', salonId: 's1', serviceId: 'srv1',
      minWeightKg: 0, maxWeightKg: 9999,
      baseDurationMinutes: 120,
      basePrice: 0, 
      includedMinutes: 0, 
      overtimeRatePerMin: 1.0 
    };

    const staff: StaffData = {
      id: 'st1', salonId: 's1', name: 'Apprenti', 
      role: StaffRole.APPRENTICE, speedIndex: 1.3, allowedServiceIds: []
    };

    const activeModifiers: ModifierRuleData[] = [];
    const staffModifiers: ModifierRuleData[] = [
      { id: 'm1', salonId: 's1', triggerType: 'IS_APPRENTICE', 
        addedMinutes: 0, priceEffectFlat: 0, priceEffectPercent: -0.2, isActive: true }
    ];

    const tTheoretical = computeTheoreticalDuration(baseRule, activeModifiers);
    expect(tTheoretical).toBe(120);

    const quote = buildQuote(baseRule, tTheoretical, staff, staffModifiers, activeModifiers);
    
    expect(quote.actualDurationMinutes).toBe(156); // 120 * 1.3
    expect(quote.clientDurationMax).toBe(172); // 156 * 1.10 = 171.6 -> 172
    expect(quote.tableDurationMinutes).toBe(187); // 172 + 15
    
    // Price: base estimated = 120 * 1.0 = 120
    // Apprentice mod: 120 * -0.2 = -24
    // Final = 120 - 24 = 96.
    expect(quote.estimatedPrice).toBeCloseTo(96);
    expect(quote.priceDisplayMode).toBe('estimate');
  });

  it('Scenario B: Caniche 8kg, FIXED, knots+behavior_bad', () => {
    // Base rule: 45€ fixed, included = Infinity. Base duration = 60min.
    const baseRule: BaseRuleData = {
      id: 'r2', salonId: 's1', serviceId: 'srv2',
      minWeightKg: 0, maxWeightKg: 10,
      baseDurationMinutes: 60,
      basePrice: 45, 
      includedMinutes: 9999, 
      overtimeRatePerMin: 0 
    };

    const staff: StaffData = {
      id: 'st2', salonId: 's1', name: 'Pro', 
      role: StaffRole.PROFESSIONAL, speedIndex: 1.0, allowedServiceIds: []
    };

    const activeModifiers: ModifierRuleData[] = [
      { id: 'm2', salonId: 's1', triggerType: 'HAS_KNOTS', 
        addedMinutes: 15, priceEffectFlat: 10, priceEffectPercent: 0, isActive: true },
      { id: 'm3', salonId: 's1', triggerType: 'BEHAVIOR_BAD', 
        addedMinutes: 15, priceEffectFlat: 15, priceEffectPercent: 0, isActive: true }
    ];

    const tTheoretical = computeTheoreticalDuration(baseRule, activeModifiers);
    expect(tTheoretical).toBe(90); // 60 + 15 + 15

    const quote = buildQuote(baseRule, tTheoretical, staff, [], activeModifiers);
    
    expect(quote.actualDurationMinutes).toBe(90); // 90 * 1.0
    expect(quote.clientDurationMax).toBe(99); // 90 * 1.10
    expect(quote.tableDurationMinutes).toBe(114); // 99 + 15
    
    // Price: base estimated = 45
    // Modifiers = +10 + 15 = 25
    // Final = 45 + 25 = 70
    expect(quote.estimatedPrice).toBeCloseTo(70);
    expect(quote.priceDisplayMode).toBe('exact');
  });

  it('MissingRuleException when rule not found', () => {
    expect(() => {
      findBaseRule([], 'srv1', 5);
    }).toThrow('No BaseRule found');
  });
});
