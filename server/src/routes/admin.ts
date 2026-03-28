import { Router } from "express";
import { db } from "../db.js";
import { hashPassword, requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { logAudit } from "../audit.js";
import { notifyUser } from "../notifications.js";

const r = Router();
r.use(requireAuth, requireRoles("admin"));

/** All bookable providers (for admin schedule picker). */
r.get("/staff-list", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, c.name AS clinic_name
       FROM users u
       LEFT JOIN clinics c ON c.id = u.clinic_id
       WHERE u.role = 'staff' AND u.active = 1 AND IFNULL(u.is_clinic_coordinator, 0) = 0
       ORDER BY c.name, u.name`
    )
    .all() as { id: number; name: string; clinic_name: string | null }[];
  res.json({ staff: rows });
});

r.post("/staff", (req, res) => {
  const u = (req as AuthedRequest).user!;
  const { email, password, name, specialization, clinic_id, is_clinic_coordinator } = req.body ?? {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password, name required" });
  }
  const cid = Number(clinic_id);
  if (!cid) return res.status(400).json({ error: "clinic_id is required for staff" });
  const clinic = db.prepare("SELECT id FROM clinics WHERE id = ?").get(cid);
  if (!clinic) return res.status(400).json({ error: "Invalid clinic_id" });
  const coord = Boolean(is_clinic_coordinator);
  const existing = db.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").get(email);
  if (existing) return res.status(409).json({ error: "Email already in use" });
  const password_hash = hashPassword(String(password));
  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, name, role, specialization, clinic_id, is_clinic_coordinator)
       VALUES (?, ?, ?, 'staff', ?, ?, ?)`
    )
    .run(
      email,
      password_hash,
      String(name),
      specialization ? String(specialization) : null,
      cid,
      coord ? 1 : 0
    );
  const id = Number(info.lastInsertRowid);
  logAudit(u.uid, "admin_register_staff", "user", id, email);
  notifyUser(id, "Your healthcare staff account was created. Please log in and review your schedule.", "email");
  res.status(201).json({
    id,
    email,
    name,
    role: "staff",
    specialization: specialization ?? null,
    clinic_id: cid,
    is_clinic_coordinator: coord,
  });
});

r.get("/users", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.specialization, u.clinic_id, u.is_clinic_coordinator,
              u.active, u.created_at, c.name AS clinic_name
       FROM users u
       LEFT JOIN clinics c ON c.id = u.clinic_id
       ORDER BY u.role, u.name`
    )
    .all();
  res.json({ users: rows });
});

r.patch("/users/:id", (req, res) => {
  const u = (req as AuthedRequest).user!;
  const id = Number(req.params.id);
  const { active } = req.body ?? {};
  if (typeof active !== "boolean") return res.status(400).json({ error: "active boolean required" });
  const target = db.prepare("SELECT id, role FROM users WHERE id = ?").get(id) as
    | { id: number; role: string }
    | undefined;
  if (!target) return res.status(404).json({ error: "Not found" });
  if (target.role === "admin" && !active) {
    return res.status(400).json({ error: "Cannot deactivate last admin via this demo" });
  }
  db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  logAudit(u.uid, "admin_user_active", "user", id, JSON.stringify({ active }));
  res.json({ ok: true });
});

r.get("/reports/summary", (_req, res) => {
  const byStatus = db
    .prepare(
      `SELECT status, COUNT(*) AS c FROM appointments GROUP BY status`
    )
    .all() as { status: string; c: number }[];
  const totalUsers = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  const upcoming = db
    .prepare(
      `SELECT COUNT(*) AS c FROM appointments
       WHERE appt_date >= date('now') AND status IN ('pending', 'confirmed')`
    )
    .get() as { c: number };
  res.json({
    appointmentsByStatus: Object.fromEntries(byStatus.map((x) => [x.status, x.c])),
    totalUsers: totalUsers.c,
    upcomingAppointments: upcoming.c,
  });
});

r.get("/logs", (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const rows = db
    .prepare(
      `SELECT l.*, u.email AS user_email
       FROM audit_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.id DESC
       LIMIT ?`
    )
    .all(limit);
  res.json({ logs: rows });
});

export default r;
