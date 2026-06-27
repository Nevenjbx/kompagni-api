import { ModifierRuleData, AnimalData, StaffData, AppointmentNoteData } from './types';
import { computeDifficultyScore } from './difficulty-score';
import { getDaysPassed } from './utils';
import { RuleEffect } from './rule-evaluator';

/**
 * Bridge : convertit des ModifierRule (système legacy) en RuleEffect génériques
 * pour qu'un seul chemin d'application (V2) gère durée + prix. Évite la perte
 * silencieuse des ModifierRule quand un salon a aussi des SalonRule.
 */
export function modifiersToEffects(mods: ModifierRuleData[]): RuleEffect[] {
  const effects: RuleEffect[] = [];
  for (const m of mods) {
    if (m.addedMinutes) {
      effects.push({ type: 'DURATION', action: 'ADD', value: m.addedMinutes, ruleName: m.triggerType });
    }
    if (m.priceEffectFlat) {
      effects.push({ type: 'PRICE', action: 'ADD', value: m.priceEffectFlat, ruleName: m.triggerType });
    }
    if (m.priceEffectPercent) {
      effects.push({ type: 'PRICE', action: 'MULTIPLY', value: 1 + m.priceEffectPercent, ruleName: m.triggerType });
    }
  }
  return effects;
}

export function getActiveModifiers(
  rules: ModifierRuleData[],
  animal: AnimalData,
  note?: AppointmentNoteData | null,
  difficultyScore?: number,
): ModifierRuleData[] {
  // Réutilise le score déjà calculé par l'appelant si fourni, sinon le calcule.
  const score = difficultyScore ?? computeDifficultyScore(animal, note);

  return rules.filter(rule => {
    if (!rule.isActive) return false;

    switch (rule.triggerType) {
      case 'HAS_KNOTS':
        return !!note?.hasKnotsToday;
      case 'BEHAVIOR_BAD':
        return score >= 4;
      case 'FIRST_VISIT':
        return !animal.lastGroomedAt;
      case 'INTERVAL_LONG':
        if (!animal.lastGroomedAt) return false;
        const daysSince = getDaysPassed(animal.lastGroomedAt);
        return daysSince > 84;
      default:
        return false; // Staff specific rules are evaluated in getStaffSpecificModifiers
    }
  });
}

export function getStaffSpecificModifiers(
  rules: ModifierRuleData[],
  staff: StaffData,
): ModifierRuleData[] {
  return rules.filter(rule => {
    if (!rule.isActive) return false;
    
    if (rule.triggerType === 'IS_APPRENTICE') {
         return staff.role === 'APPRENTICE';
    }
    return false;
  });
}


