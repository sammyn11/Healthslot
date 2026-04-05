import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { initSchema, db } from "./db.js";
import { authMiddleware } from "./auth.js";
import authRoutes from "./routes/auth.js";
import staffDirectory from "./routes/staffDirectory.js";
import appointments from "./routes/appointments.js";
import staffDaily from "./routes/staffDaily.js";
import admin from "./routes/admin.js";
import notifications from "./routes/notifications.js";
import clinics from "./routes/clinics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
initSchema();

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
const devOrigins = [clientOrigin, "http://127.0.0.1:5173", "http://localhost:5173"];

app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? clientOrigin : devOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(authMiddleware);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/clinics", clinics);
app.use("/api/auth", authRoutes);
app.use("/api/staff-directory", staffDirectory);
app.use("/api/appointments", appointments);
app.use("/api/staff", staffDaily);
app.use("/api/admin", admin);
app.use("/api/notifications", notifications);

const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[HealthSlot]", err.stack ?? err.message);
    res.status(500).json({
      error:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message || "Internal server error",
    });
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`HealthSlot API http://127.0.0.1:${PORT} (and http://localhost:${PORT})`);
});

process.on("SIGINT", () => {
  db.close();
  process.exit(0);
});
