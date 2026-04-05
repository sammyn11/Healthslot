import type { User } from "./auth";

/** Where to send someone after a successful login. */
export function homeAfterLogin(user: Pick<User, "role" | "is_clinic_coordinator">): string {
  if (user.role === "patient") return "/patient";
  if (user.role === "admin") return "/admin";
  if (user.role === "staff" && user.is_clinic_coordinator) return "/clinic";
  return "/staff";
}
