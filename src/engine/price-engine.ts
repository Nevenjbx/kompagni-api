import { BaseRuleData } from './types';

/**
 * Computes base price purely from the BaseRule and Theoretical Duration.
 * Does not apply modifiers directly.
 */
export function computePrice(rule: BaseRuleData, theoreticalDuration: number): number {
  const included = rule.includedMinutes >= 9999 ? Infinity : rule.includedMinutes;
  const billableMinutes = Math.max(0, theoreticalDuration - included);
  return rule.basePrice + billableMinutes * rule.overtimeRatePerMin;
}
