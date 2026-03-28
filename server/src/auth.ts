import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { JwtPayload, Role } from "./types.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-healthslot-secret-change-in-production";
const COOKIE_NAME = "healthslot_token";

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 12);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function signToken(payload: JwtPayload): string {
  const p: Record<string, unknown> = {
    uid: payload.uid,
    role: payload.role,
    email: payload.email,
  };
  if (payload.cid != null) p.cid = payload.cid;
  if (payload.coord) p.coord = true;
  return jwt.sign(p, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const raw = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    return {
      uid: Number(raw.uid),
      role: raw.role as Role,
      email: String(raw.email),
      cid: raw.cid != null ? Number(raw.cid) : undefined,
      coord: raw.coord === true || raw.coord === 1,
    };
  } catch {
    return null;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME] ?? req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    (req as AuthedRequest).user = null;
    return next();
  }
  const payload = verifyToken(token);
  (req as AuthedRequest).user = payload;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const u = (req as AuthedRequest).user;
  if (!u) return res.status(401).json({ error: "Authentication required" });
  next();
}

export function requireRoles(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const u = (req as AuthedRequest).user;
    if (!u) return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(u.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

export type AuthedRequest = Request & { user: JwtPayload | null };

export { COOKIE_NAME, JWT_SECRET };
