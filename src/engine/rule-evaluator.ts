/**
 * Rule Evaluator — Generic engine for evaluating SalonRules.
 *
 * Replaces the hardcoded modifier-evaluator.ts with a dynamic
 * condition/effect system where rules are data-driven.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface RuleContext {
  animal: {
    weightKg: number;
    category: string;
    coatType: string;
    groomingBehavior: string;
    skinCondition: string;
    difficultyScore: number;
    lastGroomedAt: Date | null;
    daysSinceGroom: number;
  };
  staff: {
    role: string;
    speedIndex: number;
  };
  appointment: {
    hasKnots: boolean;
    isFirstVisit: boolean;
  };
  client: {
    visitCount: number;
  };
}

export interface RuleEffect {
  type: 'DURATION' | 'PRICE' | 'SCHEDULING';
  action: 'ADD' | 'MULTIPLY' | 'BLOCK_RESOURCE';
  value: number;
  ruleName: string; // For debugging / audit trail
}

export interface SalonRuleData {
  id: string;
  salonId: string;
  name: string;
  isActive: boolean;
  priority: number;
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  effectType: string;
  effectAction: string;
  effectValue: number;
}

// ─── Core Functions ─────────────────────────────────────────────

/**
 * Resolves a dotted field path from the rule context.
 * e.g. "animal.weightKg" → context.animal.weightKg
 */
export function resolveField(fieldPath: string, context: RuleContext): any {
  const parts = fieldPath.split('.');
  let current: any = context;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }

  return current;
}

/**
 * Compares a resolved field value against a target value using the given operator.
 * The target value is always stored as a string and is cast appropriately.
 */
export function matchesCondition(
  fieldValue: any,
  operator: string,
  targetValue: string,
): boolean {
  if (fieldValue === undefined || fieldValue === null) return false;

  // Tolère les espaces parasites venus de la saisie utilisateur ("true ", " 20").
  const target = targetValue.trim();

  // Handle boolean comparisons
  if (typeof fieldValue === 'boolean') {
    const t = target.toLowerCase();
    const targetBool = t === 'true' || t === '1' || t === 'yes' || t === 'oui';
    switch (operator) {
      case '==': return fieldValue === targetBool;
      case '!=': return fieldValue !== targetBool;
      default: return false;
    }
  }

  // Handle numeric comparisons
  if (typeof fieldValue === 'number') {
    const targetNum = parseFloat(target);
    if (isNaN(targetNum)) return false;

    switch (operator) {
      case '==': return fieldValue === targetNum;
      case '!=': return fieldValue !== targetNum;
      case '>':  return fieldValue > targetNum;
      case '<':  return fieldValue < targetNum;
      case '>=': return fieldValue >= targetNum;
      case '<=': return fieldValue <= targetNum;
      default: return false;
    }
  }

  // Handle string/enum comparisons
  if (typeof fieldValue === 'string') {
    const normalizedField = fieldValue.trim().toUpperCase();
    const normalizedTarget = target.toUpperCase();

    switch (operator) {
      case '==': return normalizedField === normalizedTarget;
      case '!=': return normalizedField !== normalizedTarget;
      default: return false;
    }
  }

  return false;
}

/**
 * Evaluates all active rules against the given context and returns applicable effects.
 * Rules are processed in priority order (lowest priority number = applied first).
 *
 * @param rules - Salon rules, should already be sorted by priority asc
 * @param context - The current evaluation context
 * @param filterType - Optional: only return effects of this type
 */
export function evaluateRules(
  rules: SalonRuleData[],
  context: RuleContext,
  filterType?: 'DURATION' | 'PRICE' | 'SCHEDULING',
): RuleEffect[] {
  return rules
    .filter(rule => {
      if (!rule.isActive) return false;
      if (filterType && rule.effectType !== filterType) return false;
      
      const fieldValue = resolveField(rule.conditionField, context);
      return matchesCondition(fieldValue, rule.conditionOperator, rule.conditionValue);
    })
    .map(rule => ({
      type: rule.effectType as RuleEffect['type'],
      action: rule.effectAction as RuleEffect['action'],
      value: rule.effectValue,
      ruleName: rule.name,
    }));
}

/**
 * Applies duration effects to a base duration.
 * Effects are applied in order: ADD adds/subtracts minutes, MULTIPLY scales.
 */
export function applyDurationEffects(baseDuration: number, effects: RuleEffect[]): number {
  let duration = baseDuration;

  for (const effect of effects) {
    if (effect.action === 'ADD') {
      duration += effect.value;
    } else if (effect.action === 'MULTIPLY') {
      duration *= effect.value;
    }
  }

  return Math.max(0, Math.round(duration));
}

/**
 * Applies price effects to a base price.
 * Effects are applied in order (as configured by the salon owner).
 */
export function applyPriceEffects(basePrice: number, effects: RuleEffect[]): number {
  let price = basePrice;

  for (const effect of effects) {
    if (effect.action === 'ADD') {
      price += effect.value;
    } else if (effect.action === 'MULTIPLY') {
      price *= effect.value;
    }
  }

  return Math.max(0, Number(price.toFixed(2)));
}
