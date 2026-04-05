export type Role = "patient" | "staff" | "admin";

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  specialization: string | null;
  clinic_id?: number | null;
  is_clinic_coordinator?: number;
  /** 0 = coordinator must set password via clinic kiosk once; 1 = use password on clinic sign-in */
  coordinator_password_set?: number;
  active: number;
  created_at: string;
};

export type JwtPayload = {
  uid: number;
  role: Role;
  email: string;
  /** Set for staff linked to a clinic */
  cid?: number;
  /** 1 when user is clinic coordinator (approves all clinic appointments) */
  coord?: boolean;
};
