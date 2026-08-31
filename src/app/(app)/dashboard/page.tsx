import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDashboardSummary } from "@/lib/dashboard/queries";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const summary = await getDashboardSummary(session.user.clinicId, {
    id: session.user.id,
    role: session.user.role,
  });

  const todayLabel = new Date().toLocaleDateString("ar-EG-u-nu-latn", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isDoctor = session.user.role === "doctor";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "صباح الخير" : hour < 18 ? "مساء الخير" : "مساء الخير";
  const firstName = (session.user.name ?? "").trim().split(/\s+/)[0];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* رأس الصفحة: تحية + التاريخ + بحث + أزرار إجراء سريع */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {greeting}
            {isDoctor ? `، د. ${firstName}` : ""} 👋
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {todayLabel} — {isDoctor ? "نظرة سريعة على مرضاك النهاردة" : "إليك نظرة سريعة على أداء عيادتك اليوم"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/patients/new"
            className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          >
            + إضافة مريض
          </Link>
          <Link
            href="/appointments/new"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          >
            + حجز موعد
          </Link>
        </div>
      </div>

      <DashboardClient summary={summary} role={session.user.role} userName={session.user.name ?? ""} />
    </div>
  );
}
