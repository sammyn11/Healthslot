import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth.js";

const r = Router();
r.use(requireAuth);

r.get("/", (req, res) => {
  const u = (req as AuthedRequest).user!;
  const rows = db
    .prepare(
      `SELECT id, message, type, status, is_read, created_at
       FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100`
    )
    .all(u.uid);
  res.json({ notifications: rows });
});

r.post("/:id/read", (req, res) => {
  const u = (req as AuthedRequest).user!;
  const id = Number(req.params.id);
  const n = db.prepare("SELECT id FROM notifications WHERE id = ? AND user_id = ?").get(id, u.uid);
  if (!n) return res.status(404).json({ error: "Not found" });
  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(id);
  res.json({ ok: true });
});

export default r;
