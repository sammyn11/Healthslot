import { Router } from "express";
import { db } from "../db.js";
import { CLINIC_SLUG_ORDER } from "../clinicDefaults.js";

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

export default r;
