import { 
  AnimalCategory,
  CoatType,
  GroomingBehavior,
  SkinCondition,
  StaffRole
} from '@prisma/client';

export interface BaseRuleData {
  id: string;
  salonId: string;
  serviceId: string;
  minWeightKg: number;
  maxWeightKg: number;
  baseDurationMinutes: number;
  basePrice: number;
  includedMinutes: number;
  overtimeRatePerMin: number;
}

export interface ModifierRuleData {
  id: string;
  salonId: string;
  triggerType: string;
  addedMinutes: number;
  priceEffectFlat: number;
  priceEffectPercent: number;
  isActive: boolean;
}

export interface StaffData {
  id: string;
  salonId: string;
  name: string;
  role: StaffRole;
  speedIndex: number;
  allowedServiceIds: string[];
  weeklySchedule?: any;
  leaves?: any;
}

export interface AnimalData {
  id: string;
  species: string;
  birthDate: Date;
  isNeutered: boolean;
  weightKg: number;
  category: AnimalCategory;
  coatType: CoatType;
  groomingBehavior: GroomingBehavior;
  skinCondition: SkinCondition;
  lastGroomedAt: Date | null;
}

export interface AnimalRefinementData {
  id?: string;
  weightKg?: number | null;
  coatType?: CoatType | null;
  groomingBehavior?: GroomingBehavior | null;
  skinCondition?: SkinCondition | null;
}

export interface AppointmentNoteData {
  hasKnotsToday: boolean;
  precautions?: string | null;
  clientFreeNote?: string | null;
}

export interface QuoteResult {
  theoreticalDurationMinutes: number;
  actualDurationMinutes: number;
  clientDurationMax: number;
  tableDurationMinutes: number;
  estimatedPrice: number;
  priceDisplayMode: 'exact' | 'estimate';
  priceDisplayDisclaimer?: string | null;
  appliedModifiers: string[];
}

export class MissingRuleException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingRuleException';
  }
}

export class ClientBlockedException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientBlockedException';
  }
}

export class LockExpiredException extends Error {
  nextSlot?: Date;
  
  constructor(message: string, nextSlot?: Date) {
    super(message);
    this.name = 'LockExpiredException';
    this.nextSlot = nextSlot;
  }
}
