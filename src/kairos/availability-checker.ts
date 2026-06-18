import { AppointmentStatus, ProviderAbsence, WorkingHours } from '@prisma/client';
import { StaffData } from '../engine/types';

// We need an augmented AppointmentData type that represents the DB snapshot
// Since we are decoupling in-memory checks, we define the shape we need here.
export interface BookingData {
  id: string;
  staffId: string;
  status: AppointmentStatus;
  slotStart: Date;
  slotEnd: Date;
}

export interface WorkingDay {
  dayOfWeek: number;
  startTime: string; // "09:00"
  endTime: string;
  breakStartTime: string | null;
  breakEndTime: string | null;
}

export function isAvailable(
  staff: StaffData,
  start: Date,
  end: Date,
  allAppointments: BookingData[],
  salonWorkingHours: WorkingDay[],
  absences: ProviderAbsence[],
): boolean {
  // 1. Check existing appointment conflicts for this staff
  const hasConflict = allAppointments.some(appt => 
    appt.staffId === staff.id &&
    // Check overlapping periods: StartA < EndB AND EndA > StartB
    appt.slotStart < end &&
    appt.slotEnd > start &&
    (appt.status === 'CONFIRMED' || appt.status === 'PENDING' || appt.status === 'IN_PROGRESS')
  );

  if (hasConflict) return false;

  // 2. Check absences (Overlapping check)
  const hasAbsence = absences.some(abs => 
    start < abs.endDate && end > abs.startDate
  );
  
  if (hasAbsence) return false;

  // 3. Check staff specific schedule (leaves JSON)
  // Assuming leaves: [{ startDate, endDate }]
  const staffLeaves: any[] = typeof staff.leaves === 'string' ? JSON.parse(staff.leaves) : staff.leaves;
  if (Array.isArray(staffLeaves)) {
    const hasLeaf = staffLeaves.some(leaf => {
       const leafStart = new Date(leaf.startDate);
       const leafEnd = new Date(leaf.endDate);
       return start < leafEnd && end > leafStart;
    });
    if (hasLeaf) return false;
  }

  // 4. Check staff weekly schedule vs salon hours
  const dayOfWeek = start.getDay();
  const salonDayRule = salonWorkingHours.find(wh => wh.dayOfWeek === dayOfWeek);

  if (staff.followSalonSchedule) {
    // Mode salon : vérifier uniquement la pause du salon
    if (salonDayRule?.breakStartTime && salonDayRule?.breakEndTime) {
      if (overlapsBreak(start, end, salonDayRule.breakStartTime, salonDayRule.breakEndTime)) {
        return false;
      }
    }
    return true;
  }

  // Mode custom : l'employé a ses propres horaires
  const staffSchedule: any[] = typeof staff.weeklySchedule === 'string'
    ? JSON.parse(staff.weeklySchedule)
    : staff.weeklySchedule;

  const staffRule = (Array.isArray(staffSchedule) ? staffSchedule : [])
    .find(s => s.dayOfWeek === dayOfWeek);

  if (!staffRule) return false; // Pas d'entrée pour ce jour → l'employé ne travaille pas

  // Vérifier les bornes de l'employé
  if (!isTimeWithinBounds(start, end, staffRule.startTime, staffRule.endTime)) {
    return false;
  }

  // Vérifier la pause de l'employé
  if (staffRule.breakStartTime && staffRule.breakEndTime) {
    if (overlapsBreak(start, end, staffRule.breakStartTime, staffRule.breakEndTime)) {
      return false;
    }
  }

  // Vérifier aussi la pause du salon
  if (salonDayRule?.breakStartTime && salonDayRule?.breakEndTime) {
    if (overlapsBreak(start, end, salonDayRule.breakStartTime, salonDayRule.breakEndTime)) {
      return false;
    }
  }

  return true;
}

function isTimeWithinBounds(start: Date, end: Date, startTimeStr: string, endTimeStr: string): boolean {
  const [startH, startM] = startTimeStr.split(':').map(Number);
  const [endH, endM] = endTimeStr.split(':').map(Number);
  
  const slotStartMins = start.getHours() * 60 + start.getMinutes();
  const slotEndMins = end.getHours() * 60 + end.getMinutes();
  
  const ruleStartMins = startH * 60 + startM;
  const ruleEndMins = endH * 60 + endM;

  return slotStartMins >= ruleStartMins && slotEndMins <= ruleEndMins;
}

function overlapsBreak(start: Date, end: Date, breakStartStr: string, breakEndStr: string): boolean {
  const [bStartH, bStartM] = breakStartStr.split(':').map(Number);
  const [bEndH, bEndM] = breakEndStr.split(':').map(Number);
  
  const slotStartMins = start.getHours() * 60 + start.getMinutes();
  const slotEndMins = end.getHours() * 60 + end.getMinutes();
  
  const breakStartMins = bStartH * 60 + bStartM;
  const breakEndMins = bEndH * 60 + bEndM;

  return slotStartMins < breakEndMins && slotEndMins > breakStartMins;
}
