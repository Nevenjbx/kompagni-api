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

  // 2. Check absences
  const hasAbsence = absences.some(abs => 
    start >= abs.startDate && start < abs.endDate
  );
  
  if (hasAbsence) return false;

  // 3. Check staff specific schedule (leaves JSON)
  // Assuming leaves: [{ startDate, endDate }]
  const staffLeaves: any[] = typeof staff.leaves === 'string' ? JSON.parse(staff.leaves) : staff.leaves;
  if (Array.isArray(staffLeaves)) {
    const hasLeaf = staffLeaves.some(leaf => {
       const leafStart = new Date(leaf.startDate);
       const leafEnd = new Date(leaf.endDate);
       return start >= leafStart && start < leafEnd;
    });
    if (hasLeaf) return false;
  }

  // 4. Check staff weekly schedule rules vs Salon hours
  // Usually if staff has no specific weekly schedule, they follow salon working hours.
  // Wait, the plan says: `isAvailable() - 2. Check weekly schedule. 3. Check breaks.`
  // For now we will rely on Gate 1 (isSalonOpen) and Gate 4 (slotEnd <= closingTime) for base hours,
  // but if staff has custom hours, we check here.
  const staffSchedule: any[] = typeof staff.weeklySchedule === 'string' 
     ? JSON.parse(staff.weeklySchedule) 
     : staff.weeklySchedule;

  const dayOfWeek = start.getDay();
  let dayRule = salonWorkingHours.find(wh => wh.dayOfWeek === dayOfWeek);

  if (Array.isArray(staffSchedule) && staffSchedule.length > 0) {
     const staffRule = staffSchedule.find(s => s.dayOfWeek === dayOfWeek);
     if (staffRule) {
       // Staff has a custom rule. 
       if (!isTimeWithinBounds(start, end, staffRule.startTime, staffRule.endTime)) {
         return false;
       }
       if (staffRule.breakStartTime && staffRule.breakEndTime) {
         if (overlapsBreak(start, end, staffRule.breakStartTime, staffRule.breakEndTime)) {
           return false;
         }
       }
       return true; // Staff rule passes
     }
  }

  // If no staff specific rule, check salon breaks
  if (dayRule && dayRule.breakStartTime && dayRule.breakEndTime) {
     if (overlapsBreak(start, end, dayRule.breakStartTime, dayRule.breakEndTime)) {
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
