import { BaseRuleData, ModifierRuleData, StaffData, QuoteResult, MissingRuleException } from './types';
import { computePrice } from './price-engine';
import { RuleEffect, applyDurationEffects, applyPriceEffects } from './rule-evaluator';

/** Default values — used as fallback when SalonParams are not provided */
export const DEFAULT_TRANSITION_BUFFER_MIN = 15;
export const DEFAULT_CLIENT_DURATION_MARGIN_PERCENT = 10;

/** Per-salon algorithm parameters, loaded from SalonConfig */
export interface SalonParams {
  transitionBufferMin: number;
  clientDurationMarginPercent: number;
}

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

// ─── Legacy: ModifierRule-based computation (kept for backward compatibility) ───

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
  activeModifiers: ModifierRuleData[],
  salonParams?: SalonParams,
): QuoteResult {
  const transitionBuffer = salonParams?.transitionBufferMin ?? DEFAULT_TRANSITION_BUFFER_MIN;
  const marginPercent = salonParams?.clientDurationMarginPercent ?? DEFAULT_CLIENT_DURATION_MARGIN_PERCENT;
  const marginMultiplier = 1 + (marginPercent / 100);

  const actualDurationMinutes = Math.round(theoreticalDuration * staff.speedIndex);
  const clientDurationMax = Math.round(actualDurationMinutes * marginMultiplier);
  const tableDurationMinutes = clientDurationMax + transitionBuffer;
  
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

// ─── New: RuleEffect-based computation (used with SalonRules) ───

/**
 * Computes theoretical duration using the new generic RuleEffect system.
 */
export function computeTheoreticalDurationV2(
  baseRule: BaseRuleData,
  durationEffects: RuleEffect[],
): number {
  return applyDurationEffects(baseRule.baseDurationMinutes, durationEffects);
}

/**
 * Builds a quote using the new RuleEffect system.
 * Duration effects should already be applied to produce theoreticalDuration.
 */
export function buildQuoteV2(
  baseRule: BaseRuleData,
  theoreticalDuration: number,
  staff: StaffData,
  priceEffects: RuleEffect[],
  salonParams?: SalonParams,
  durationEffects: RuleEffect[] = [],
): QuoteResult {
  const transitionBuffer = salonParams?.transitionBufferMin ?? DEFAULT_TRANSITION_BUFFER_MIN;
  const marginPercent = salonParams?.clientDurationMarginPercent ?? DEFAULT_CLIENT_DURATION_MARGIN_PERCENT;
  const marginMultiplier = 1 + (marginPercent / 100);

  const actualDurationMinutes = Math.round(theoreticalDuration * staff.speedIndex);
  const clientDurationMax = Math.round(actualDurationMinutes * marginMultiplier);
  const tableDurationMinutes = clientDurationMax + transitionBuffer;
  
  const baseEstimatedPrice = computePrice(baseRule, theoreticalDuration);
  const finalPrice = applyPriceEffects(baseEstimatedPrice, priceEffects);
  
  const isFixed = baseRule.includedMinutes >= 9999;

  return {
    theoreticalDurationMinutes: theoreticalDuration,
    actualDurationMinutes,
    clientDurationMax,
    tableDurationMinutes,
    estimatedPrice: finalPrice,
    priceDisplayMode: isFixed ? 'exact' : 'estimate',
    priceDisplayDisclaimer: isFixed ? null : 'Prix final à confirmer selon temps réel',
    // Audit trail complet : règles ayant modifié la durée ET le prix (sans doublon).
    appliedModifiers: [...new Set([...durationEffects, ...priceEffects].map(e => e.ruleName))],
  };
}
