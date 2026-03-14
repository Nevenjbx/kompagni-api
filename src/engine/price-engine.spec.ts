import { computePrice } from './price-engine';
import { BaseRuleData } from './types';

describe('Price Engine', () => {
  it('should compute exact price for FIXED mode', () => {
    const fixedRule: BaseRuleData = {
      id: 'r1', salonId: 's1', serviceId: 'srv1',
      minWeightKg: 0, maxWeightKg: 9999,
      baseDurationMinutes: 60,
      basePrice: 42.70,
      includedMinutes: 9999,
      overtimeRatePerMin: 0,
    };
    
    expect(computePrice(fixedRule, 45)).toBeCloseTo(42.70);
    expect(computePrice(fixedRule, 120)).toBeCloseTo(42.70);
  });

  it('should compute pure hourly rate for TIME_BASED mode', () => {
    const timeRule: BaseRuleData = {
      id: 'r2', salonId: 's1', serviceId: 'srv2',
      minWeightKg: 0, maxWeightKg: 9999,
      baseDurationMinutes: 0,
      basePrice: 0,
      includedMinutes: 0,
      overtimeRatePerMin: 0.33,
    };
    
    // 90 minutes * 0.33 = 29.70
    expect(computePrice(timeRule, 90)).toBeCloseTo(29.70);
  });

  it('should compute mixed BASE_PLUS_TIME mode (under included time)', () => {
    const mixedRule: BaseRuleData = {
      id: 'r3', salonId: 's1', serviceId: 'srv3',
      minWeightKg: 0, maxWeightKg: 9999,
      baseDurationMinutes: 60,
      basePrice: 54.70,
      includedMinutes: 60,
      overtimeRatePerMin: 0.723,
    };
    
    expect(computePrice(mixedRule, 60)).toBeCloseTo(54.70);
  });

  it('should compute mixed BASE_PLUS_TIME mode (overtime)', () => {
    const mixedRule: BaseRuleData = {
      id: 'r3', salonId: 's1', serviceId: 'srv3',
      minWeightKg: 0, maxWeightKg: 9999,
      baseDurationMinutes: 60,
      basePrice: 54.70,
      includedMinutes: 60,
      overtimeRatePerMin: 0.723,
    };
    
    // 90 mins -> 30 mins overtime. 30 * 0.723 = 21.69. 54.70 + 21.69 = 76.39
    expect(computePrice(mixedRule, 90)).toBeCloseTo(76.39);
  });
});
