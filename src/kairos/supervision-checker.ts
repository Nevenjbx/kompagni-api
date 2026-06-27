import { ProviderAbsence } from '@prisma/client';
import { StaffData } from '../engine/types';
import { isAvailable, BookingData, WorkingDay } from './availability-checker';

/**
 * Supervision (mode formation).
 *
 * Règle métier :
 *   « Quand un apprenti (superviseeRole) prend un RDV, un pro (supervisorRole)
 *     doit être libre pour l'encadrer. Un pro peut encadrer
 *     maxConcurrentSupervisions apprentis en même temps. »
 *
 * Ce n'est PAS une règle SI/ALORS générique : c'est une contrainte de
 * ressource (le superviseur) avec une capacité. On la traite donc comme
 * une "gate" dédiée du Kairos Engine, sur le même modèle que la capacité tables.
 *
 * Modèle de capacité :
 *   capacité = (nb de superviseurs libres sur le créneau) × maxConcurrentSupervisions
 *   demande  = (nb d'apprentis déjà posés sur le créneau) + 1 (le nouveau)
 *   → OK si demande ≤ capacité
 *
 * Un superviseur est « libre » s'il travaille ce créneau et n'a pas son propre
 * RDV en cours (isAvailable gère conflits + horaires + absences + congés).
 */

export interface SupervisionConfig {
  enabled: boolean;
  supervisorRole: string;
  superviseeRole: string;
  maxConcurrentSupervisions: number;
  blockSupervisorWhenApprenticeBooked: boolean;
}

export interface SupervisionBooking extends BookingData {
  staffRole: string; // rôle du staff qui porte ce RDV
}

function overlaps(a: { slotStart: Date; slotEnd: Date }, start: Date, end: Date): boolean {
  return a.slotStart < end && a.slotEnd > start;
}

/**
 * Détermine si le créneau [start, end) peut être encadré.
 *
 * @param candidateRole rôle du staff qui prend CE nouveau RDV
 * @param allStaff      tous les membres du salon (pour trouver les superviseurs)
 * @param dayAppointments RDV du jour (doivent porter le rôle du staff)
 */
export function hasSupervisionCapacity(
  candidateRole: string,
  start: Date,
  end: Date,
  allStaff: StaffData[],
  dayAppointments: SupervisionBooking[],
  salonWorkingHours: WorkingDay[],
  absences: ProviderAbsence[],
  config: SupervisionConfig,
): boolean {
  // Supervision désactivée, ou le candidat n'a pas besoin d'être supervisé → OK
  if (!config.enabled) return true;
  if (candidateRole !== config.superviseeRole) return true;

  // Combien de superviseurs sont libres pour encadrer sur ce créneau ?
  const availableSupervisors = allStaff.filter(
    (s) =>
      s.role === config.supervisorRole &&
      isAvailable(s, start, end, dayAppointments, salonWorkingHours, absences),
  ).length;

  // Aucun superviseur libre → impossible de poser l'apprenti
  if (availableSupervisors === 0) return false;

  const capacity = availableSupervisors * config.maxConcurrentSupervisions;

  // Apprentis déjà posés qui chevauchent ce créneau (hors le nouveau)
  const superviseesBooked = dayAppointments.filter(
    (a) =>
      a.staffRole === config.superviseeRole &&
      overlaps(a, start, end) &&
      (a.status === 'CONFIRMED' || a.status === 'PENDING' || a.status === 'IN_PROGRESS'),
  ).length;

  // +1 pour le RDV qu'on essaie de poser
  return superviseesBooked + 1 <= capacity;
}

/**
 * Gate 7b — Bloque un superviseur (pro) si des apprentis ont déjà un RDV
 * sur le créneau et que ce pro est nécessaire pour couvrir la supervision.
 *
 * Logique : si ce pro prend son propre RDV, il ne sera plus disponible pour
 * superviser. On vérifie que les autres superviseurs libres suffisent à couvrir
 * le nombre d'apprentis déjà posés. Si ce n'est pas le cas, on bloque ce pro.
 *
 * @returns true si le pro DOIT être bloqué (slot refusé)
 */
export function isSupervisorBlockedByApprentices(
  candidateStaffId: string,
  candidateRole: string,
  start: Date,
  end: Date,
  allStaff: any[],
  dayAppointments: SupervisionBooking[],
  salonWorkingHours: WorkingDay[],
  absences: ProviderAbsence[],
  config: SupervisionConfig,
): boolean {
  if (!config.enabled) return false;
  if (!config.blockSupervisorWhenApprenticeBooked) return false;
  if (candidateRole !== config.supervisorRole) return false;

  // Apprentis déjà posés sur ce créneau
  const apprenticeBookings = dayAppointments.filter(
    (a) =>
      a.staffRole === config.superviseeRole &&
      overlaps(a, start, end) &&
      (a.status === 'CONFIRMED' || a.status === 'PENDING' || a.status === 'IN_PROGRESS'),
  ).length;

  if (apprenticeBookings === 0) return false;

  // Superviseurs libres sur ce créneau, en excluant le candidat
  const otherAvailableSupervisors = allStaff.filter(
    (s) =>
      s.id !== candidateStaffId &&
      s.role === config.supervisorRole &&
      isAvailable(s as any, start, end, dayAppointments, salonWorkingHours, absences),
  ).length;

  // Capacité restante sans ce pro
  const remainingCapacity = otherAvailableSupervisors * config.maxConcurrentSupervisions;

  // Bloquer si la capacité résiduelle ne couvre pas les apprentis déjà posés
  return apprenticeBookings > remainingCapacity;
}
