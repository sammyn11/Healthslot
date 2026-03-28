import fs from "node:fs";
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CLINICS } from "./clinicDefaults.js";

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
  ensureFiveNamedClinics();
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
