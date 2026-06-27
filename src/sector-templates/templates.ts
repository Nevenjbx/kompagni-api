/**
 * Sector Templates — Static configuration constants per sector type.
 *
 * Templates define the structural foundation shared by all salons in a sector.
 * They are NOT stored in the database — they are code constants.
 */

export interface ConditionOption {
  field: string;
  label: string;
  type: 'boolean' | 'number' | 'enum';
  unit?: string;
  options?: string[];
}

export interface EffectOption {
  type: string;
  label: string;
  actions: string[];
  unit: string;
}

/**
 * Describes the supervision capability of a sector (mode formation).
 * `supportsSupervision: false` hides the supervision card in the salon UI.
 */
export interface SupervisionSpec {
  supportsSupervision: boolean;
  supervisorRole: string;        // role that supervises (ex: PROFESSIONAL)
  superviseeRole: string;        // role that needs supervision (ex: APPRENTICE)
  defaultMaxConcurrent: number;  // how many supervisees one supervisor can cover
  label: string;                 // human label shown in UI
}

export interface SectorTemplate {
  id: string;
  label: string;
  description: string;
  icon: string;

  // Structure
  bookingUnit: 'TIME_SLOT' | 'NIGHT';
  resources: string[];
  defaultSlicingAttribute: string;

  // Default SalonConfig values
  defaults: {
    groomingTables: string[];
    transitionBufferMin: number;
    clientDurationMarginPercent: number;
    breakBetweenAppointmentsMin: number;
    slotGranularityMin: number;
    planningHorizonDays: number;
  };

  // Available staff roles
  staffRoles: string[];

  // Supervision capability (structural — drives the dedicated UI card)
  supervision: SupervisionSpec;

  // Available conditions for rules UI
  availableConditions: ConditionOption[];

  // Available effects for rules UI
  availableEffects: EffectOption[];
}

export const SECTOR_TEMPLATES: Record<string, SectorTemplate> = {
  GROOMER: {
    id: 'GROOMER',
    label: 'Toiletteur',
    description: 'Salon de toilettage pour chiens, chats et NAC',
    icon: '✂️',

    bookingUnit: 'TIME_SLOT',
    resources: ['staff', 'groomingTable'],
    defaultSlicingAttribute: 'weightKg',

    defaults: {
      groomingTables: ['LARGE', 'SMALL'],
      transitionBufferMin: 15,
      clientDurationMarginPercent: 10,
      breakBetweenAppointmentsMin: 0,
      slotGranularityMin: 30,
      planningHorizonDays: 14,
    },

    staffRoles: ['PROFESSIONAL', 'APPRENTICE'],

    supervision: {
      supportsSupervision: true,
      supervisorRole: 'PROFESSIONAL',
      superviseeRole: 'APPRENTICE',
      defaultMaxConcurrent: 3,
      label: 'Supervision des apprentis',
    },

    availableConditions: [
      { field: 'animal.weightKg', label: 'Poids de l\'animal', type: 'number', unit: 'kg' },
      { field: 'animal.category', label: 'Catégorie', type: 'enum', options: ['SMALL', 'LARGE', 'GIANT', 'CAT', 'NAC'] },
      { field: 'animal.coatType', label: 'Type de pelage', type: 'enum', options: ['SHORT', 'NORMAL', 'LONG', 'CURLY', 'DOUBLE_COAT', 'MATTED'] },
      { field: 'animal.groomingBehavior', label: 'Comportement', type: 'enum', options: ['EASY', 'NERVOUS', 'DIFFICULT'] },
      { field: 'animal.skinCondition', label: 'État de la peau', type: 'enum', options: ['NORMAL', 'SENSITIVE', 'PROBLEM'] },
      { field: 'animal.difficultyScore', label: 'Score de difficulté', type: 'number' },
      { field: 'animal.daysSinceGroom', label: 'Jours depuis dernier toilettage', type: 'number', unit: 'jours' },
      { field: 'staff.role', label: 'Rôle de l\'employé', type: 'enum', options: ['PROFESSIONAL', 'APPRENTICE'] },
      { field: 'appointment.hasKnots', label: 'Nœuds ce jour', type: 'boolean' },
      { field: 'appointment.isFirstVisit', label: 'Première visite', type: 'boolean' },
      { field: 'client.visitCount', label: 'Nombre de visites du client', type: 'number' },
    ],

    availableEffects: [
      { type: 'DURATION', label: 'Durée estimée', actions: ['ADD', 'MULTIPLY'], unit: 'min' },
      { type: 'PRICE', label: 'Prix', actions: ['ADD', 'MULTIPLY'], unit: '€' },
    ],
  },

  // Future templates: VET, BOARDING
  // They will follow the exact same structure
};

export function getSectorTemplate(templateId: string): SectorTemplate | undefined {
  return SECTOR_TEMPLATES[templateId];
}

export function getAllSectorTemplates(): SectorTemplate[] {
  return Object.values(SECTOR_TEMPLATES);
}
