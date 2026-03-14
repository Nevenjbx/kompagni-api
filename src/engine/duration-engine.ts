import { BaseRuleData, ModifierRuleData, StaffData, QuoteResult, MissingRuleException } from './types';
import { computePrice } from './price-engine';

export const TRANSITION_BUFFER = 15;

export function findBaseRule(
  rules: BaseRuleData[],
  serviceId: string,
  weightKg: number,
): BaseRuleData {
  const match = rules.find(r => 
    r.serviceId === serviceId && 
    weightKg >= r.minWeightKg && 
    weightKg <= r.maxWeightKg // maxWeightKg is 9999 for infinity
  );
  if (!match) {
    throw new MissingRuleException(`No BaseRule found for serviceId=${serviceId} and weight=${weightKg}kg`);
  }
  return match;
}

export function computeTheoreticalDuration(
  baseRule: BaseRuleData,
  activeModifiers: ModifierRuleData[]
): number {
  const added = activeModifiers.reduce((sum, mod) => sum + mod.addedMinutes, 0);
  return baseRule.baseDurationMinutes + added;
}

export function buildQuote(
  baseRule: BaseRuleData,
  theoreticalDuration: number,
  staff: StaffData,
  staffModifiers: ModifierRuleData[],
  activeModifiers: ModifierRuleData[]
): QuoteResult {
  const actualDurationMinutes = Math.round(theoreticalDuration * staff.speedIndex);
  const clientDurationMax = Math.round(actualDurationMinutes * 1.10);
  const tableDurationMinutes = clientDurationMax + TRANSITION_BUFFER;
  
  const baseEstimatedPrice = computePrice(baseRule, theoreticalDuration);
  
  let finalPrice = baseEstimatedPrice;
  const allModifiers = [...activeModifiers, ...staffModifiers];

  for (const mod of allModifiers) {
    finalPrice += mod.priceEffectFlat;
    finalPrice += baseEstimatedPrice * mod.priceEffectPercent;
  }
  
  const isFixed = baseRule.includedMinutes >= 9999;

  return {
    theoreticalDurationMinutes: theoreticalDuration,
    actualDurationMinutes,
    clientDurationMax,
    tableDurationMinutes,
    estimatedPrice: Number(finalPrice.toFixed(2)),
    priceDisplayMode: isFixed ? 'exact' : 'estimate',
    priceDisplayDisclaimer: isFixed ? null : 'Prix final à confirmer selon temps réel',
    appliedModifiers: allModifiers.map(m => m.triggerType)
  };
}
