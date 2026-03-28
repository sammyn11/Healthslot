import { Router } from "express";
import { db } from "../db.js";
import {
  hashPassword,
  verifyPassword,
  signToken,
  COOKIE_NAME,
  requireAuth,
  type AuthedRequest,
} from "../auth.js";
import { logAudit } from "../audit.js";
import type { UserRow } from "../types.js";

const r = Router();

r.post("/register", (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password, and name are required" });
  }
  const existing = db.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").get(email);
  if (existing) return res.status(409).json({ error: "Email already registered" });
  const password_hash = hashPassword(String(password));
  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'patient')`
    )
    .run(email, password_hash, String(name));
  const id = Number(info.lastInsertRowid);
  logAudit(id, "patient_register", "user", id, email);
  const token = signToken({ uid: id, role: "patient", email: String(email) });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({
    user: {
      id,
      email,
      name,
      role: "patient",
      clinic_id: null,
      is_clinic_coordinator: false,
      clinic_name: null,
    },
  });
});

r.post("/login", (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  const row = db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email) as
    | UserRow
    | undefined;
  if (!row || !row.active) return res.status(401).json({ error: "Invalid credentials" });
  if (!verifyPassword(String(password), row.password_hash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signToken({
    uid: row.id,
    role: row.role,
    email: row.email,
    cid: row.role === "staff" ? row.clinic_id ?? undefined : undefined,
    coord: !!(row.role === "staff" && Number(row.is_clinic_coordinator || 0)),
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  logAudit(row.id, "login", "user", row.id);
  const clinic = row.clinic_id
    ? (db.prepare("SELECT name FROM clinics WHERE id = ?").get(row.clinic_id) as { name: string } | undefined)
    : null;
  res.json({
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      specialization: row.specialization,
      clinic_id: row.clinic_id,
      is_clinic_coordinator: !!row.is_clinic_coordinator,
      clinic_name: clinic?.name ?? null,
    },
  });
});

r.post("/logout", requireAuth, (req, res) => {
  const u = (req as AuthedRequest).user!;
  logAudit(u.uid, "logout", "user", u.uid);
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

r.get("/me", (req, res) => {
  const u = (req as AuthedRequest).user;
  if (!u) return res.json({ user: null });
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.specialization, u.clinic_id, u.is_clinic_coordinator, u.active,
              c.name AS clinic_name
       FROM users u
       LEFT JOIN clinics c ON c.id = u.clinic_id
       WHERE u.id = ?`
    )
    .get(u.uid) as
    | {
        id: number;
        email: string;
        name: string;
        role: string;
        specialization: string | null;
        clinic_id: number | null;
        is_clinic_coordinator: number;
        active: number;
        clinic_name: string | null;
      }
    | undefined;
  if (!row || !row.active) return res.json({ user: null });
  res.json({
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      specialization: row.specialization,
      clinic_id: row.clinic_id,
      is_clinic_coordinator: !!row.is_clinic_coordinator,
      clinic_name: row.clinic_name,
    },
  });
});

export default r;
