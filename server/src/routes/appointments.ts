import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import type { JwtPayload } from "../types.js";
import { getAvailableTimes, pickFirstClinicAppointmentSlot, pickProviderForSlot } from "../slots.js";
import { notifyUser } from "../notifications.js";
import { logAudit } from "../audit.js";

const r = Router();

r.use(requireAuth);

function canManageAppointment(u: JwtPayload, appointmentStaffId: number): boolean {
  if (u.role === "admin") return true;
  if (u.role !== "staff") return false;
  if (u.coord && u.cid != null) {
    const doc = db
      .prepare("SELECT clinic_id FROM users WHERE id = ? AND role = 'staff'")
      .get(appointmentStaffId) as { clinic_id: number | null } | undefined;
    return !!doc && doc.clinic_id === u.cid;
  }
  return appointmentStaffId === u.uid;
}

/** Patient: own appointments. Staff: own schedule or whole clinic if coordinator. Admin: all. */
r.get("/", (req, res) => {
  const u = (req as AuthedRequest).user!;
  let rows: unknown[];
  if (u.role === "patient") {
    rows = db
      .prepare(
        `SELECT a.*, p.name AS patient_name, s.name AS staff_name, s.specialization,
                c.name AS clinic_name
         FROM appointments a
         JOIN users p ON p.id = a.patient_id
         JOIN users s ON s.id = a.staff_id
         LEFT JOIN clinics c ON c.id = s.clinic_id
         WHERE a.patient_id = ?
         ORDER BY a.appt_date DESC, a.appt_time DESC`
      )
      .all(u.uid);
  } else if (u.role === "staff") {
    if (u.coord && u.cid != null) {
      rows = db
        .prepare(
          `SELECT a.*, p.name AS patient_name, p.email AS patient_email, s.name AS staff_name, s.specialization
           FROM appointments a
           JOIN users p ON p.id = a.patient_id
           JOIN users s ON s.id = a.staff_id
           WHERE s.clinic_id = ?
           ORDER BY a.appt_date DESC, a.appt_time DESC`
        )
        .all(u.cid);
    } else {
      rows = db
        .prepare(
          `SELECT a.*, p.name AS patient_name, p.email AS patient_email, s.name AS staff_name
           FROM appointments a
           JOIN users p ON p.id = a.patient_id
           JOIN users s ON s.id = a.staff_id
           WHERE a.staff_id = ?
           ORDER BY a.appt_date, a.appt_time`
        )
        .all(u.uid);
    }
  } else {
    rows = db
      .prepare(
        `SELECT a.*, p.name AS patient_name, p.email AS patient_email, s.name AS staff_name
         FROM appointments a
         JOIN users p ON p.id = a.patient_id
         JOIN users s ON s.id = a.staff_id
         ORDER BY a.appt_date DESC, a.appt_time DESC
         LIMIT 500`
      )
      .all();
  }
  res.json({ appointments: rows });
});

r.post("/", requireRoles("patient"), (req, res) => {
  const u = (req as AuthedRequest).user!;
  const { clinic_id, appt_date, appt_time: bodyTime } = req.body ?? {};
  const cid = Number(clinic_id);
  if (!cid || !appt_date) {
    return res.status(400).json({ error: "clinic_id and appt_date required" });
  }
  const clinic = db.prepare("SELECT id, name FROM clinics WHERE id = ?").get(cid) as
    | { id: number; name: string }
    | undefined;
  if (!clinic) return res.status(400).json({ error: "Invalid clinic" });

  let appt_time: string;
  let sid: number;
  let staff: { id: number; name: string };

  if (bodyTime != null && String(bodyTime).length > 0) {
    const picked = pickProviderForSlot(cid, String(appt_date), String(bodyTime));
    if (!picked) {
      return res.status(409).json({ error: "No provider available at this clinic for that time" });
    }
    appt_time = String(bodyTime);
    sid = picked.id;
    staff = picked;
  } else {
    const first = pickFirstClinicAppointmentSlot(cid, String(appt_date));
    if (!first) {
      return res.status(409).json({ error: "No openings at this clinic on that date—try another day" });
    }
    appt_time = first.appt_time;
    sid = first.staff.id;
    staff = first.staff;
  }

  try {
    const info = db
      .prepare(
        `INSERT INTO appointments (patient_id, staff_id, appt_date, appt_time, status)
         VALUES (?, ?, ?, ?, 'pending')`
      )
      .run(u.uid, sid, String(appt_date), appt_time);
    const id = Number(info.lastInsertRowid);
    logAudit(
      u.uid,
      "appointment_book",
      "appointment",
      id,
      JSON.stringify({ clinic_id: cid, staff_id: sid, appt_date, appt_time })
    );
    const msg = `Your appointment at ${clinic.name} on ${appt_date} at ${appt_time} is pending confirmation (${staff.name} was assigned).`;
    notifyUser(u.uid, msg, "email");
    const staffMsg = `New booking at ${clinic.name} for ${appt_date} at ${appt_time}.`;
    notifyUser(sid, staffMsg, "email");
    res.status(201).json({ id, status: "pending", staff_id: sid, appt_time });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "Slot already taken" });
    }
    throw e;
  }
});

r.patch("/:id", requireRoles("patient"), (req, res) => {
  const u = (req as AuthedRequest).user!;
  const id = Number(req.params.id);
  const { action, appt_date, appt_time } = req.body ?? {};
  const row = db
    .prepare("SELECT * FROM appointments WHERE id = ? AND patient_id = ?")
    .get(id, u.uid) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ error: "Appointment not found" });

  if (action === "cancel") {
    db.prepare(`UPDATE appointments SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(id);
    logAudit(u.uid, "appointment_cancel", "appointment", id);
    notifyUser(u.uid, `Your appointment on ${row.appt_date} at ${row.appt_time} was cancelled.`, "email");
    const sid = Number(row.staff_id);
    notifyUser(sid, `A patient cancelled an appointment on ${row.appt_date} at ${row.appt_time}.`, "email");
    return res.json({ ok: true, status: "cancelled" });
  }

  if (action === "reschedule") {
    if (!appt_date || !appt_time) return res.status(400).json({ error: "appt_date and appt_time required" });
    const sid = Number(row.staff_id);
    const available = getAvailableTimes(sid, String(appt_date));
    if (!available.includes(String(appt_time))) {
      return res.status(409).json({ error: "New slot not available" });
    }
    try {
      db.prepare(
        `UPDATE appointments SET appt_date = ?, appt_time = ?, status = 'pending', updated_at = datetime('now') WHERE id = ?`
      ).run(String(appt_date), String(appt_time), id);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).json({ error: "Slot already taken" });
      }
      throw e;
    }
    logAudit(u.uid, "appointment_reschedule", "appointment", id);
    notifyUser(
      u.uid,
      `Your appointment was rescheduled to ${appt_date} at ${appt_time} (pending confirmation).`,
      "email"
    );
    notifyUser(sid, `A patient rescheduled to ${appt_date} at ${appt_time}.`, "email");
    return res.json({ ok: true, status: "pending" });
  }

  return res.status(400).json({ error: "Unknown action" });
});

/** Staff (incl. clinic coordinators) / Admin: approve or modify appointment */
r.post("/:id/manage", requireRoles("staff", "admin"), (req, res) => {
  const u = (req as AuthedRequest).user!;
  const id = Number(req.params.id);
  const { status, appt_date, appt_time } = req.body ?? {};
  const row = db.prepare("SELECT * FROM appointments WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return res.status(404).json({ error: "Not found" });
  const apptStaffId = Number(row.staff_id);
  if (u.role === "staff" && !canManageAppointment(u, apptStaffId)) {
    return res.status(403).json({ error: "You cannot manage this appointment" });
  }

  if (status === "confirmed" && row.status !== "cancelled") {
    db.prepare(`UPDATE appointments SET status = 'confirmed', updated_at = datetime('now') WHERE id = ?`).run(id);
    logAudit(u.uid, "appointment_approve", "appointment", id);
    notifyUser(
      Number(row.patient_id),
      `Your appointment on ${row.appt_date} at ${row.appt_time} has been confirmed.`,
      "email"
    );
    return res.json({ ok: true, status: "confirmed" });
  }

  if (status === "completed" || status === "missed" || status === "no_show") {
    db.prepare(`UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
    logAudit(u.uid, "appointment_attendance", "appointment", id, status);
    if (status === "missed" || status === "no_show") {
      notifyUser(Number(row.patient_id), `Your appointment on ${row.appt_date} was marked as ${status}.`, "sms");
    }
    return res.json({ ok: true, status });
  }

  if (appt_date && appt_time) {
    const sid = Number(row.staff_id);
    const available = getAvailableTimes(sid, String(appt_date));
    if (!available.includes(String(appt_time))) {
      return res.status(409).json({ error: "Slot not available" });
    }
    try {
      db.prepare(
        `UPDATE appointments SET appt_date = ?, appt_time = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(String(appt_date), String(appt_time), id);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Slot taken" });
      throw e;
    }
    logAudit(u.uid, "appointment_modify", "appointment", id);
    notifyUser(
      Number(row.patient_id),
      `Your appointment was updated to ${appt_date} at ${appt_time} by clinic staff.`,
      "email"
    );
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: "Provide status or appt_date+appt_time" });
});

export default r;
