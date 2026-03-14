import { ModifierRuleData, AnimalData, StaffData, AppointmentNoteData } from './types';
import { computeDifficultyScore } from './difficulty-score';

export function getActiveModifiers(
  rules: ModifierRuleData[],
  animal: AnimalData,
  note?: AppointmentNoteData | null,
): ModifierRuleData[] {
  return rules.filter(rule => {
    if (!rule.isActive) return false;
    
    switch (rule.triggerType) {
      case 'HAS_KNOTS':
        return !!note?.hasKnotsToday;
      case 'BEHAVIOR_BAD':
        return computeDifficultyScore(animal, note) >= 4;
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

function getDaysPassed(date: Date): number {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
