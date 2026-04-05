import { Router } from "express";
import { db } from "../db.js";
import { CLINIC_SLUG_ORDER } from "../clinicDefaults.js";
import { mergeAvailableTimesAtClinic } from "../slots.js";

const r = Router();

/** Only the five booking locations (stable order for the appointment UI). */
r.get("/", (_req, res) => {
  const placeholders = CLINIC_SLUG_ORDER.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT id, name, address, slug FROM clinics WHERE slug IN (${placeholders})`
    )
    .all(...CLINIC_SLUG_ORDER) as { id: number; name: string; address: string | null; slug: string }[];

  const order = new Map(CLINIC_SLUG_ORDER.map((s, i) => [s, i]));
  rows.sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99));

  res.json({ clinics: rows });
});

/** Open visit times at this clinic on a date (union across providers). */
r.get("/:id/slots", (req, res) => {
  const id = Number(req.params.id);
  const date = String(req.query.date ?? "");
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: "Invalid clinic id" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Query ?date=YYYY-MM-DD required" });
  }
  const clinic = db.prepare("SELECT id FROM clinics WHERE id = ?").get(id) as { id: number } | undefined;
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });
  const times = mergeAvailableTimesAtClinic(id, date);
  res.json({ clinic_id: id, date, times });
});

export default r;
