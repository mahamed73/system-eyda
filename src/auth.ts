import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import type { UserRole } from "@/lib/types";
import { authConfig } from "@/auth.config";

interface UserRow {
  id: string;
  clinic_id: string;
  clinic_name: string;
  name: string;
  role: UserRole;
  phone: string;
  password_hash: string;
  is_active: boolean;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        phone: { label: "رقم الهاتف", type: "text" },
        password: { label: "كلمة المرور", type: "password" },
      },
      async authorize(credentials) {
        const phone = credentials?.phone as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!phone || !password) return null;

        // Multi-tenancy: تسجيل الدخول بيتم بالتليفون فقط (unique عالميًا)
        // وبعدها كل حاجة في الجلسة بتتفلتر بـ clinic_id بتاع اليوزر ده.
        const { rows } = await query<UserRow>(
          `SELECT u.id, u.clinic_id, c.name AS clinic_name, u.name, u.role,
                  u.phone, u.password_hash, u.is_active
           FROM users u
           JOIN clinics c ON c.id = u.clinic_id
           WHERE u.phone = $1
           LIMIT 1`,
          [phone]
        );

        const user = rows[0];
        if (!user || !user.is_active) return null;

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;

        return {
          id: user.id,
          clinicId: user.clinic_id,
          clinicName: user.clinic_name,
          name: user.name,
          role: user.role,
          phone: user.phone,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.clinicId = (user as unknown as { clinicId: string }).clinicId;
        token.clinicName = (user as unknown as { clinicName: string }).clinicName;
        token.role = (user as unknown as { role: UserRole }).role;
        token.phone = (user as unknown as { phone: string }).phone;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id as string,
        clinicId: token.clinicId as string,
        clinicName: token.clinicName as string,
        role: token.role as UserRole,
        phone: token.phone as string,
        name: token.name as string,
      };
      return session;
    },
  },
});
