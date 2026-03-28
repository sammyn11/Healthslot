import { db } from "./db.js";

export function logAudit(
  userId: number | null,
  action: string,
  entityType?: string,
  entityId?: number,
  details?: string
) {
  db.prepare(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, action, entityType ?? null, entityId ?? null, details ?? null);
}
