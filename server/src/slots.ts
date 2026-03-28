import { db } from "./db.js";

/** ISO date YYYY-MM-DD */
const SLOT_START_MIN = 8 * 60;
const SLOT_END_MIN = 17 * 60;
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

export function providerIdsAtClinic(clinicId: number): number[] {
  const rows = db
    .prepare(
      `SELECT id FROM users
       WHERE clinic_id = ? AND role = 'staff' AND active = 1
       AND IFNULL(is_clinic_coordinator, 0) = 0
       ORDER BY id`
    )
    .all(clinicId) as { id: number }[];
  return rows.map((r) => r.id);
}

/** Union of open times across all providers at the clinic (sorted). */
export function mergeAvailableTimesAtClinic(clinicId: number, apptDate: string): string[] {
  const open = new Set<string>();
  for (const id of providerIdsAtClinic(clinicId)) {
    for (const t of getAvailableTimes(id, apptDate)) open.add(t);
  }
  return slotTimesForDay().filter((t) => open.has(t));
}

/** Earliest open slot at the clinic on that day plus an assigned provider. */
export function pickFirstClinicAppointmentSlot(
  clinicId: number,
  apptDate: string
): { appt_time: string; staff: { id: number; name: string } } | null {
  const times = mergeAvailableTimesAtClinic(clinicId, apptDate);
  if (times.length === 0) return null;
  const appt_time = times[0];
  const staff = pickProviderForSlot(clinicId, apptDate, appt_time);
  if (!staff) return null;
  return { appt_time, staff };
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
