import { AnimalCategory } from '@prisma/client';
import { hasCapacity, BookingWithCategoryData } from './capacity-checker';

function makeAppt(category: AnimalCategory, startH: number, endH: number): BookingWithCategoryData {
  const base = new Date('2026-06-16T00:00:00Z');
  return {
    id: `appt-${Math.random()}`,
    staffId: 'staff1',
    status: 'CONFIRMED',
    slotStart: new Date(base.getTime() + startH * 3600000),
    slotEnd: new Date(base.getTime() + endH * 3600000),
    petCategory: category,
  };
}

const slot9 = new Date('2026-06-16T09:00:00Z');
const slot11 = new Date('2026-06-16T11:00:00Z');

describe('hasCapacity (grooming tables)', () => {

  it('should accept first animal when no existing appointments', () => {
    expect(hasCapacity('SMALL', slot9, slot11, [], ['LARGE', 'SMALL'])).toBe(true);
  });

  it('should accept a small animal on a LARGE table', () => {
    expect(hasCapacity('SMALL', slot9, slot11, [], ['LARGE'])).toBe(true);
  });

  it('should reject a LARGE animal on a SMALL table', () => {
    expect(hasCapacity('LARGE', slot9, slot11, [], ['SMALL'])).toBe(false);
  });

  it('should reject a GIANT animal on a LARGE table', () => {
    expect(hasCapacity('GIANT', slot9, slot11, [], ['LARGE'])).toBe(false);
  });

  it('should accept a GIANT animal on a GIANT table', () => {
    expect(hasCapacity('GIANT', slot9, slot11, [], ['GIANT'])).toBe(true);
  });

  it('should accept CAT on a SMALL table', () => {
    expect(hasCapacity('CAT', slot9, slot11, [], ['SMALL'])).toBe(true);
  });

  it('should accept NAC on a SMALL table', () => {
    expect(hasCapacity('NAC', slot9, slot11, [], ['SMALL'])).toBe(true);
  });

  // ─── Combination tests ────────────────────────────────────────

  it('1 LARGE + 3 SMALL on tables [GIANT, LARGE, SMALL, SMALL] → ok', () => {
    const existing = [
      makeAppt('LARGE', 9, 11),
      makeAppt('SMALL', 9, 11),
      makeAppt('SMALL', 9, 11),
    ];
    // Requesting a 4th SMALL
    expect(hasCapacity('SMALL', slot9, slot11, existing, ['GIANT', 'LARGE', 'SMALL', 'SMALL'])).toBe(true);
  });

  it('2 LARGE + 2 SMALL on tables [GIANT, LARGE, SMALL, SMALL] → ok', () => {
    const existing = [
      makeAppt('LARGE', 9, 11),
      makeAppt('SMALL', 9, 11),
      makeAppt('SMALL', 9, 11),
    ];
    // Requesting a 2nd LARGE → LARGE(2) goes on GIANT(3) table, LARGE(2) on LARGE(2) table, 2x SMALL on SMALL tables
    expect(hasCapacity('LARGE', slot9, slot11, existing, ['GIANT', 'LARGE', 'SMALL', 'SMALL'])).toBe(true);
  });

  it('3 LARGE on tables [GIANT, LARGE, SMALL, SMALL] → reject (only 2 tables can hold LARGE)', () => {
    const existing = [
      makeAppt('LARGE', 9, 11),
      makeAppt('LARGE', 9, 11),
    ];
    // 3rd LARGE → sorted animals [2,2,2], tables [3,2,1,1] → 2≤3 ✓, 2≤2 ✓, 2≤1 ✗ → reject
    expect(hasCapacity('LARGE', slot9, slot11, existing, ['GIANT', 'LARGE', 'SMALL', 'SMALL'])).toBe(false);
  });

  it('all 4 tables full → reject any new animal', () => {
    const existing = [
      makeAppt('SMALL', 9, 11),
      makeAppt('SMALL', 9, 11),
      makeAppt('SMALL', 9, 11),
      makeAppt('SMALL', 9, 11),
    ];
    expect(hasCapacity('SMALL', slot9, slot11, existing, ['GIANT', 'LARGE', 'SMALL', 'SMALL'])).toBe(false);
  });

  // ─── Non-overlapping appointments should not count ─────────────

  it('should not count non-overlapping appointments', () => {
    const earlier = [makeAppt('SMALL', 7, 8)]; // ends before slot starts
    expect(hasCapacity('SMALL', slot9, slot11, earlier, ['SMALL'])).toBe(true);
  });

  // ─── Single table salon ────────────────────────────────────────

  it('single GIANT table: accepts GIANT, rejects 2nd animal', () => {
    expect(hasCapacity('GIANT', slot9, slot11, [], ['GIANT'])).toBe(true);
    const existing = [makeAppt('SMALL', 9, 11)];
    expect(hasCapacity('GIANT', slot9, slot11, existing, ['GIANT'])).toBe(false);
  });
});
