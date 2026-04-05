import { Router, type Response } from "express";
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
import { DEMO_COORDINATOR_PASSWORD } from "../clinicDefaults.js";

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
    ? (db
        .prepare("SELECT name, address, slug FROM clinics WHERE id = ?")
        .get(row.clinic_id) as
        | { name: string; address: string | null; slug: string }
        | undefined)
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
      clinic_address: clinic?.address ?? null,
      clinic_slug: clinic?.slug ?? null,
    },
  });
});

type ClinicRow = { id: number; name: string; address: string | null; slug: string };

/** NULL is_clinic_coordinator must not exclude rows — use IFNULL(..., 0) = 1 */
function lookupClinicCoordinator(slug: string): {
  clinic: ClinicRow | null;
  row: UserRow | null;
} {
  const clinic = db.prepare("SELECT id, name, address, slug FROM clinics WHERE slug = ?").get(slug) as
    | ClinicRow
    | undefined;
  if (!clinic) return { clinic: null, row: null };
  const row = db
    .prepare(
      `SELECT * FROM users
       WHERE role = 'staff' AND IFNULL(is_clinic_coordinator, 0) = 1 AND active = 1 AND clinic_id = ?
       ORDER BY id ASC LIMIT 1`
    )
    .get(clinic.id) as UserRow | undefined;
  return { clinic, row: row ?? null };
}

function coordinatorNotFoundMessage(slug: string, clinic: ClinicRow | null): { status: number; error: string } {
  if (!clinic) {
    return {
      status: 404,
      error: `Unknown clinic "${slug}". Run the API (port 4000), then open the app at http://localhost:5173 (not 4000).`,
    };
  }
  return {
    status: 404,
    error: `No active coordinator for "${clinic.name}" yet. Stop and start the API once — it creates demo coordinators automatically.`,
  };
}

function issueCoordinatorSession(
  res: Response,
  row: UserRow,
  clinic: { name: string; address: string | null; slug: string }
) {
  const token = signToken({
    uid: row.id,
    role: row.role,
    email: row.email,
    cid: row.clinic_id ?? undefined,
    coord: true,
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      specialization: row.specialization,
      clinic_id: row.clinic_id,
      is_clinic_coordinator: true,
      clinic_name: clinic.name,
      clinic_address: clinic.address,
      clinic_slug: clinic.slug,
    },
  });
}

/** Whether this clinic’s coordinator still needs a first-time password (kiosk setup). */
r.get("/clinic-coordinator-state", (req, res) => {
  const slug = typeof req.query.slug === "string" ? req.query.slug.trim() : "";
  if (!slug) return res.status(400).json({ error: "slug query parameter required" });
  const { clinic, row } = lookupClinicCoordinator(slug);
  if (!clinic || !row) {
    const { status, error } = coordinatorNotFoundMessage(slug, clinic);
    return res.status(status).json({ error });
  }
  const pwdSet = Number(row.coordinator_password_set ?? 1);
  res.json({
    clinicName: clinic.name,
    needsInitialPassword: pwdSet === 0,
  });
});

/** First visit: set coordinator password and sign in. */
r.post("/clinic-coordinator-setup", (req, res) => {
  const slug = typeof (req.body ?? {}).slug === "string" ? String((req.body ?? {}).slug).trim() : "";
  const password = String((req.body ?? {}).password ?? "").trim();
  if (!slug || !password) {
    return res.status(400).json({ error: "slug and password required" });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }
  const { clinic, row: coordRow } = lookupClinicCoordinator(slug);
  if (!clinic || !coordRow) {
    const { status, error } = coordinatorNotFoundMessage(slug, clinic);
    return res.status(status).json({ error });
  }
  if (Number(coordRow.coordinator_password_set ?? 1) !== 0) {
    return res.status(409).json({
      error: "Password already set for this clinic. Sign in with your clinic password below.",
    });
  }
  const password_hash = hashPassword(password);
  db.prepare(`UPDATE users SET password_hash = ?, coordinator_password_set = 1 WHERE id = ?`).run(
    password_hash,
    coordRow.id
  );
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(coordRow.id) as UserRow;
  logAudit(row.id, "clinic_coordinator_password_setup", "clinic", clinic.id, clinic.name);
  issueCoordinatorSession(res, row, {
    name: clinic.name,
    address: clinic.address,
    slug: clinic.slug,
  });
});

/** Returning visit: clinic slug + password. */
r.post("/clinic-coordinator-login", (req, res) => {
  const slug = typeof (req.body ?? {}).slug === "string" ? String((req.body ?? {}).slug).trim() : "";
  const password = String((req.body ?? {}).password ?? "").trim();
  if (!slug || !password) {
    return res.status(400).json({ error: "slug and password required" });
  }
  const { clinic, row: coordRow } = lookupClinicCoordinator(slug);
  if (!clinic || !coordRow) {
    const { status, error } = coordinatorNotFoundMessage(slug, clinic);
    return res.status(status).json({ error });
  }
  if (Number(coordRow.coordinator_password_set ?? 1) === 0) {
    return res.status(400).json({
      error: "Create your password first (first-time setup for this clinic).",
      code: "PASSWORD_SETUP_REQUIRED",
    });
  }
  const hash = coordRow.password_hash;
  const demoMatch =
    password.toLowerCase() === DEMO_COORDINATOR_PASSWORD.toLowerCase() &&
    verifyPassword(DEMO_COORDINATOR_PASSWORD, hash);
  if (!verifyPassword(password, hash) && !demoMatch) {
    return res.status(401).json({
      error: "Invalid clinic password.",
    });
  }
  logAudit(coordRow.id, "clinic_coordinator_login", "clinic", clinic.id, clinic.name);
  issueCoordinatorSession(res, coordRow, {
    name: clinic.name,
    address: clinic.address,
    slug: clinic.slug,
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
              c.name AS clinic_name, c.address AS clinic_address, c.slug AS clinic_slug
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
        clinic_address: string | null;
        clinic_slug: string | null;
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
      clinic_address: row.clinic_address,
      clinic_slug: row.clinic_slug,
    },
  });
});

export default r;
