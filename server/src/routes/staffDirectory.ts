import { Router } from "express";
import { db } from "../db.js";
import { getAvailableTimes } from "../slots.js";

const r = Router();

/** Public list of providers for booking (FR 3.1). Pass ?clinic_id= to list doctors at that clinic. */
r.get("/", (req, res) => {
  const cid = req.query.clinic_id ? Number(req.query.clinic_id) : NaN;
  if (!Number.isFinite(cid) || cid < 1) {
    return res.status(400).json({ error: "Query clinic_id is required (number)" });
  }
  const rows = db
    .prepare(
      `SELECT id, name, email, specialization FROM users
       WHERE role = 'staff' AND active = 1
       AND IFNULL(is_clinic_coordinator, 0) = 0
       AND clinic_id = ?
       ORDER BY name`
    )
    .all(cid) as { id: number; name: string; email: string; specialization: string | null }[];
  res.json({ staff: rows });
});

/** Available slots for a staff member on a date. */
r.get("/:id/slots", (req, res) => {
  const staffId = Number(req.params.id);
  const date = String(req.query.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Query ?date=YYYY-MM-DD required" });
  }
  const staff = db
    .prepare(
      `SELECT id FROM users WHERE id = ? AND role = 'staff' AND active = 1
       AND IFNULL(is_clinic_coordinator, 0) = 0`
    )
    .get(staffId);
  if (!staff) return res.status(404).json({ error: "Staff not found" });
  const times = getAvailableTimes(staffId, date);
  res.json({ date, times });
});

export default r;
