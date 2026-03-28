import { db } from "./db.js";

export function notifyUser(
  userId: number,
  message: string,
  type: "email" | "sms" = "email"
) {
  db.prepare(
    `INSERT INTO notifications (user_id, message, type, status) VALUES (?, ?, ?, 'sent')`
  ).run(userId, message, type);
  // In production: queue SMTP/SMS; here we persist + console for demo
  console.log(`[Notification → user ${userId}] (${type}) ${message}`);
}
