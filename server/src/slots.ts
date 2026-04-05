import { db } from "./db.js";

/** ISO date YYYY-MM-DD — any calendar day; times are clinic local window */
const SLOT_START_MIN = 7 * 60;
const SLOT_END_MIN = 19 * 60;
const STEP = 30;

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function slotTimesForDay(): string[] {
  const out: string[] = [];
  for (let m = SLOT_START_MIN; m < SLOT_END_MIN; m += STEP) {
    out.push(minutesToTime(m));
  }
  return out;
}

/** Returns times still free for staff on date (excludes non-cancelled bookings). */
export function getAvailableTimes(staffId: number, apptDate: string): string[] {
  const rows = db
    .prepare(
      `SELECT appt_time FROM appointments
       WHERE staff_id = ? AND appt_date = ? AND status != 'cancelled'`
    )
    .all(staffId, apptDate) as { appt_time: string }[];
  const taken = new Set(rows.map((r) => r.appt_time));
  return slotTimesForDay().filter((t) => !taken.has(t));
}

/**
 * Providers who take visits (non-coordinators). If a clinic has none, fall back to any active staff
 * (e.g. coordinator only) so bookings are never impossible for lack of a “doctor” row.
 */
export function providerIdsAtClinic(clinicId: number): number[] {
  const providers = db
    .prepare(
      `SELECT id FROM users
       WHERE clinic_id = ? AND role = 'staff' AND active = 1
       AND IFNULL(is_clinic_coordinator, 0) = 0
       ORDER BY id`
    )
    .all(clinicId) as { id: number }[];
  if (providers.length > 0) return providers.map((r) => r.id);
  const anyStaff = db
    .prepare(
      `SELECT id FROM users
       WHERE clinic_id = ? AND role = 'staff' AND active = 1
       ORDER BY IFNULL(is_clinic_coordinator, 0) ASC, id`
    )
    .all(clinicId) as { id: number }[];
  return anyStaff.map((r) => r.id);
}

/** Union of open times across all providers at the clinic (sorted). */
export function mergeAvailableTimesAtClinic(clinicId: number, apptDate: string): string[] {
  const open = new Set<string>();
  for (const id of providerIdsAtClinic(clinicId)) {
    for (const t of getAvailableTimes(id, apptDate)) open.add(t);
  }
  return slotTimesForDay().filter((t) => open.has(t));
}

/** Walk the day in order; first time where some assignable staff is free. */
export function pickFirstClinicAppointmentSlot(
  clinicId: number,
  apptDate: string
): { appt_time: string; staff: { id: number; name: string } } | null {
  for (const t of slotTimesForDay()) {
    const staff = pickProviderForSlot(clinicId, apptDate, t);
    if (staff) return { appt_time: t, staff };
  }
  return null;
}

/**
 * After a preferred time is unavailable: try later slots the same day, then earlier ones.
 * (So we do not jump to 07:00 when the patient asked for 10:00.)
 */
export function pickNearestAvailableSlot(
  clinicId: number,
  apptDate: string,
  preferredTime: string
): { appt_time: string; staff: { id: number; name: string } } | null {
  const slots = slotTimesForDay();
  const preferred = String(preferredTime);
  const idx = slots.indexOf(preferred);
  const order =
    idx === -1 ? slots : [...slots.slice(idx + 1), ...slots.slice(0, idx + 1)];
  for (const t of order) {
    const staff = pickProviderForSlot(clinicId, apptDate, t);
    if (staff) return { appt_time: t, staff };
  }
  return null;
}

/** First available provider at the clinic for this slot (stable order by staff id). */
export function pickProviderForSlot(
  clinicId: number,
  apptDate: string,
  apptTime: string
): { id: number; name: string } | null {
  const t = String(apptTime);
  for (const id of providerIdsAtClinic(clinicId)) {
    if (getAvailableTimes(id, apptDate).includes(t)) {
      const row = db.prepare("SELECT id, name FROM users WHERE id = ?").get(id) as {
        id: number;
        name: string;
      };
      return row;
    }
  }
  return null;
}
