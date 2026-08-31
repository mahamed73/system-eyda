"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import demoConfig from "../../../demo-config.json";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function doLogin(loginPhone: string, loginPassword: string) {
    setError(null);
    const result = await signIn("credentials", {
      phone: loginPhone,
      password: loginPassword,
      redirect: false,
    });
    if (!result || result.error) {
      setError("رقم الهاتف أو كلمة المرور غير صحيحة");
      return false;
    }
    router.push(callbackUrl);
    router.refresh();
    return true;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      await doLogin(phone, password);
    });
  }

  function handleDemo() {
    setError(null);
    startTransition(async () => {
      await doLogin(demoConfig.doctorPhone, demoConfig.doctorPassword);
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white shadow-sm border border-slate-200 rounded-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">نظام إدارة العيادات</h1>
          <p className="text-slate-500 mt-2 text-sm">سجّل الدخول للمتابعة</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              رقم الهاتف
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01000000001"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 text-right"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              كلمة المرور
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 text-right"
              dir="ltr"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 transition-colors"
          >
            {isPending ? "جاري الدخول..." : "دخول"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-300">
          <span className="flex-1 h-px bg-slate-200" />
          أو
          <span className="flex-1 h-px bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleDemo}
          disabled={isPending}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 transition-colors"
        >
          👁️ جرّب النسخة التجريبية
        </button>
        <p className="text-xs text-slate-400 text-center mt-2">
          يدخل على عيادة وهمية مليانة بيانات — من غير تسجيل
        </p>

        <div className="mt-6 text-xs text-slate-400 border-t border-slate-100 pt-4 leading-relaxed">
          بيانات تجريبية (Seed):
          <br />
          طبيب: 01000000001 / Doctor@123
          <br />
          سكرتارية: 01000000002 / Reception@123
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
