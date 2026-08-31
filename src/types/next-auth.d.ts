import type { UserRole } from "@/lib/types";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      clinicId: string;
      clinicName: string;
      role: UserRole;
      phone: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    clinicId: string;
    clinicName: string;
    role: UserRole;
    phone: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    clinicId: string;
    clinicName: string;
    role: UserRole;
    phone: string;
  }
}
