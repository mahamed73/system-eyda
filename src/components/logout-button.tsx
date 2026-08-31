"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm text-slate-600 hover:text-red-600 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
    >
      تسجيل الخروج
    </button>
  );
}
