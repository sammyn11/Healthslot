import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";

const r = Router();
r.use(requireAuth, requireRoles("staff", "admin"));

/** Daily schedule (FR 4.1). Coordinators see all providers at their clinic; others see own. */
r.get("/daily", (req, res) => {
  const u = (req as AuthedRequest).user!;
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
  let rows: unknown[];

  if (u.role === "admin") {
    const sid = Number(req.query.staff_id);
    if (!sid) {
      return res.status(400).json({ error: "Administrators must pass staff_id in the query string" });
    }
    rows = db
      .prepare(
        `SELECT a.*, p.name AS patient_name, p.email AS patient_email, s.name AS staff_name
         FROM appointments a
         JOIN users p ON p.id = a.patient_id
         JOIN users s ON s.id = a.staff_id
         WHERE a.staff_id = ? AND a.appt_date = ? AND a.status != 'cancelled'
         ORDER BY a.appt_time`
      )
      .all(sid, date);
  } else if (u.coord && u.cid != null) {
    const filterDoc = Number(req.query.staff_id);
    if (filterDoc) {
      const ok = db
        .prepare(
          `SELECT id FROM users WHERE id = ? AND clinic_id = ? AND role = 'staff'
           AND IFNULL(is_clinic_coordinator, 0) = 0`
        )
        .get(filterDoc, u.cid);
      if (!ok) return res.status(400).json({ error: "Invalid staff filter for this clinic" });
      rows = db
        .prepare(
          `SELECT a.*, p.name AS patient_name, p.email AS patient_email, s.name AS staff_name
           FROM appointments a
           JOIN users p ON p.id = a.patient_id
           JOIN users s ON s.id = a.staff_id
           WHERE a.staff_id = ? AND a.appt_date = ? AND a.status != 'cancelled'
           ORDER BY a.appt_time`
        )
        .all(filterDoc, date);
    } else {
      rows = db
        .prepare(
          `SELECT a.*, p.name AS patient_name, p.email AS patient_email, s.name AS staff_name
           FROM appointments a
           JOIN users p ON p.id = a.patient_id
           JOIN users s ON s.id = a.staff_id
           WHERE s.clinic_id = ? AND a.appt_date = ? AND a.status != 'cancelled'
           ORDER BY a.appt_time`
        )
        .all(u.cid, date);
    }
  } else {
    rows = db
      .prepare(
        `SELECT a.*, p.name AS patient_name, p.email AS patient_email, s.name AS staff_name
         FROM appointments a
         JOIN users p ON p.id = a.patient_id
         JOIN users s ON s.id = a.staff_id
         WHERE a.staff_id = ? AND a.appt_date = ? AND a.status != 'cancelled'
         ORDER BY a.appt_time`
      )
      .all(u.uid, date);
  }

  res.json({ date, appointments: rows });
});

export default r;
