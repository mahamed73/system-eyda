export type UserRole = "doctor" | "receptionist";

export interface SessionUser {
  id: string;
  clinicId: string;
  clinicName: string;
  name: string;
  role: UserRole;
  phone: string;
}
