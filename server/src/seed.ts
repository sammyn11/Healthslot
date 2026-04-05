import { initSchema, db } from "./db.js";
import { hashPassword } from "./auth.js";
import { CLINIC_SLUG_ORDER, DEMO_COORDINATOR_PASSWORD } from "./clinicDefaults.js";

initSchema();

const adminEmail = "admin@healthslot.local";
const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
if (existing) {
  console.log("Users already seeded. Delete server/data/healthslot.db to re-seed from scratch.");
  db.close();
  process.exit(0);
}

const h = hashPassword("changeme123");
const hCoordinator = hashPassword(DEMO_COORDINATOR_PASSWORD);

db.prepare(`INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, 'System Administrator', 'admin')`).run(
  adminEmail,
  h
);

const getClinicId = db.prepare("SELECT id FROM clinics WHERE slug = ?");

const insStaff = db.prepare(
  `INSERT INTO users (email, password_hash, name, role, specialization, clinic_id, is_clinic_coordinator, coordinator_password_set)
   VALUES (?, ?, ?, 'staff', ?, ?, ?, ?)`
);

for (let i = 0; i < CLINIC_SLUG_ORDER.length; i++) {
  const slug = CLINIC_SLUG_ORDER[i];
  const row = getClinicId.get(slug) as { id: number } | undefined;
  if (!row) {
    console.error(`Missing clinic slug ${slug}; run server once to create clinics.`);
    db.close();
    process.exit(1);
  }
  const cid = row.id;
  insStaff.run(
    `dr.clinic${i + 1}@healthslot.local`,
    h,
    `Dr. Provider ${i + 1}`,
    "General Practice",
    cid,
    0,
    1
  );
  insStaff.run(
    `clinic${i + 1}@healthslot.local`,
    hCoordinator,
    `Clinic Coordinator ${i + 1}`,
    "Clinic reception / approvals",
    cid,
    1,
    1
  );
}

db.prepare(`INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, 'Demo Patient', 'patient')`).run(
  "patient@healthslot.local",
  h
);

console.log("Seeded users: admin/patient/providers use password changeme123");
console.log("  Coordinators: use /clinic-login with the clinic password from server configuration.");
console.log("  Admin:     admin@healthslot.local");
console.log("  Patient:   patient@healthslot.local");
console.log("  dr.clinic1…dr.clinic5@healthslot.local — providers");
db.close();
