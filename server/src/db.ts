import fs from "node:fs";
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "./auth.js";
import { DEFAULT_CLINICS, CLINIC_SLUG_ORDER, DEMO_COORDINATOR_PASSWORD } from "./clinicDefaults.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH ?? path.join(__dirname, "..", "data", "healthslot.db");

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clinics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      slug TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('patient', 'staff', 'admin')),
      specialization TEXT,
      clinic_id INTEGER REFERENCES clinics(id),
      is_clinic_coordinator INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES users(id),
      staff_id INTEGER NOT NULL REFERENCES users(id),
      appt_date TEXT NOT NULL,
      appt_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'missed', 'no_show')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_staff_slot
      ON appointments (staff_id, appt_date, appt_time)
      WHERE status != 'cancelled';

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'email',
      status TEXT NOT NULL DEFAULT 'sent',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  migrateNotificationsReadColumn();
  migrateUserClinicColumns();
  migrateCoordinatorPasswordSet();
  ensureFiveNamedClinics();
  normalizeDemoCoordinatorFlags();
  ensureClinicCoordinators();
  syncSeededCoordinatorDemoPassword();
}

/** Older rows may have NULL is_clinic_coordinator; SQLite treats NULL = 1 as false. */
function normalizeDemoCoordinatorFlags() {
  try {
    const stmt = db.prepare(
      `UPDATE users SET is_clinic_coordinator = 1
       WHERE role = 'staff' AND clinic_id IS NOT NULL AND lower(email) = lower(?)`
    );
    for (let i = 0; i < CLINIC_SLUG_ORDER.length; i++) {
      stmt.run(`clinic${i + 1}@healthslot.local`);
    }
  } catch (e) {
    console.error("normalizeDemoCoordinatorFlags failed:", e);
  }
}

/** Ensure exactly the five named clinics exist (insert or refresh name/address by slug). */
function ensureFiveNamedClinics() {
  const sel = db.prepare("SELECT id FROM clinics WHERE slug = ?");
  const upd = db.prepare("UPDATE clinics SET name = ?, address = ? WHERE slug = ?");
  const ins = db.prepare("INSERT INTO clinics (name, address, slug) VALUES (?, ?, ?)");
  for (const c of DEFAULT_CLINICS) {
    if (sel.get(c.slug)) upd.run(c.name, c.address, c.slug);
    else ins.run(c.name, c.address, c.slug);
  }
}

function migrateUserClinicColumns() {
  try {
    const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    if (!names.includes("clinic_id")) {
      db.exec(`ALTER TABLE users ADD COLUMN clinic_id INTEGER REFERENCES clinics(id);`);
    }
    if (!names.includes("is_clinic_coordinator")) {
      db.exec(
        `ALTER TABLE users ADD COLUMN is_clinic_coordinator INTEGER NOT NULL DEFAULT 0;`
      );
    }
  } catch (e) {
    console.error("users clinic migration failed:", e);
  }
}

/** Coordinators: 0 = first visit must set password at clinic; 1 = sign in with password. Existing rows default to 1. */
function migrateCoordinatorPasswordSet() {
  try {
    const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    if (!cols.map((c) => c.name).includes("coordinator_password_set")) {
      db.exec(
        `ALTER TABLE users ADD COLUMN coordinator_password_set INTEGER NOT NULL DEFAULT 1;`
      );
    }
  } catch (e) {
    console.error("coordinator_password_set migration failed:", e);
  }
}

/**
 * Ensures each named clinic has at least one active coordinator (demo accounts clinic1@ … clinic5@).
 * Fixes "Clinic or coordinator not found" when the DB was never seeded or coordinators were removed.
 */
function ensureClinicCoordinators() {
  try {
    const h = hashPassword(DEMO_COORDINATOR_PASSWORD);
    const getClinicId = db.prepare("SELECT id FROM clinics WHERE slug = ?");
    const hasActiveCoord = db.prepare(
      `SELECT id FROM users WHERE clinic_id = ? AND role = 'staff'
       AND IFNULL(is_clinic_coordinator, 0) = 1 AND active = 1 ORDER BY id LIMIT 1`
    );
    const ins = db.prepare(
      `INSERT INTO users (email, password_hash, name, role, specialization, clinic_id, is_clinic_coordinator, coordinator_password_set)
       VALUES (?, ?, ?, 'staff', ?, ?, 1, 1)`
    );

    for (let i = 0; i < CLINIC_SLUG_ORDER.length; i++) {
      const slug = CLINIC_SLUG_ORDER[i];
      const clinicRow = getClinicId.get(slug) as { id: number } | undefined;
      if (!clinicRow) {
        console.warn(`[HealthSlot] Skipping coordinator: no clinic row for slug "${slug}"`);
        continue;
      }
      const cid = clinicRow.id;
      if (hasActiveCoord.get(cid)) continue;

      const inactive = db
        .prepare(
          `SELECT id FROM users WHERE clinic_id = ? AND role = 'staff'
           AND IFNULL(is_clinic_coordinator, 0) = 1 AND active = 0 ORDER BY id LIMIT 1`
        )
        .get(cid) as { id: number } | undefined;
      if (inactive) {
        db.prepare(
          `UPDATE users SET active = 1, password_hash = ?, coordinator_password_set = 1 WHERE id = ?`
        ).run(h, inactive.id);
        continue;
      }

      const n = i + 1;
      const email = `clinic${n}@healthslot.local`;
      const byEmail = db
        .prepare("SELECT id FROM users WHERE lower(email) = lower(?)")
        .get(email) as { id: number } | undefined;
      if (byEmail) {
        db.prepare(
          `UPDATE users SET role = 'staff', clinic_id = ?, is_clinic_coordinator = 1, active = 1,
           password_hash = ?, coordinator_password_set = 1, name = ?, specialization = ?
           WHERE id = ?`
        ).run(
          cid,
          h,
          `Clinic Coordinator ${n}`,
          "Clinic reception / approvals",
          byEmail.id
        );
        continue;
      }

      ins.run(email, h, `Clinic Coordinator ${n}`, "Clinic reception / approvals", cid);
      console.log(`[HealthSlot] Added coordinator ${email} for clinic "${slug}"`);
    }
  } catch (e) {
    console.error("ensureClinicCoordinators failed:", e);
  }
}

/**
 * Keeps `clinic1@healthslot.local` … `clinic5@` coordinator passwords aligned with DEMO_COORDINATOR_PASSWORD.
 * Fixes older DBs seeded with `changeme123` so kiosk sign-in matches the configured coordinator password.
 */
function syncSeededCoordinatorDemoPassword() {
  if (process.env.HEALTHSLOT_SKIP_DEMO_COORD_SYNC === "true") return;
  try {
    const h = hashPassword(DEMO_COORDINATOR_PASSWORD);
    const stmt = db.prepare(
      `UPDATE users SET password_hash = ?, coordinator_password_set = 1
       WHERE role = 'staff' AND IFNULL(is_clinic_coordinator, 0) = 1 AND lower(email) = lower(?)`
    );
    for (let i = 0; i < CLINIC_SLUG_ORDER.length; i++) {
      stmt.run(h, `clinic${i + 1}@healthslot.local`);
    }
  } catch (e) {
    console.error("syncSeededCoordinatorDemoPassword failed:", e);
  }
}

/** Older DBs used column name "read", which can break SQL; rename to is_read. */
function migrateNotificationsReadColumn() {
  try {
    const cols = db.prepare("PRAGMA table_info(notifications)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    if (names.includes("read") && !names.includes("is_read")) {
      db.exec(`ALTER TABLE notifications RENAME COLUMN read TO is_read;`);
    }
  } catch (e) {
    console.error("notifications column migration failed:", e);
  }
}
