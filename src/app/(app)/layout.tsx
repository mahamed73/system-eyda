import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import ToastProvider from "@/components/toast-provider";
import LiveArrivals from "@/components/live-arrivals";
import OfflineBanner from "@/components/offline-banner";
import ServiceWorkerRegister from "@/components/service-worker-register";

/**
 * Layout مشترك لكل الصفحات اللي محتاجة تسجيل دخول (لوحة التحكم، المرضى،
 * المواعيد، الزيارات، المخزون، المصروفات، التقارير). بيوفّر:
 *  - القائمة الجانبية (Sidebar) — ثابتة، بتتوسع لما الماوس يوقف عليها.
 *  - الشريط العلوي (Topbar) — اسم العيادة والمستخدم وزرار تسجيل الخروج.
 * كل صفحة جواه بترث نفس الـ Sidebar/Topbar تلقائيًا، فمفيش تكرار.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { name, role, clinicName } = session.user;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="mr-16 min-h-screen flex flex-col print:mr-0">
        <Topbar clinicName={clinicName} userName={name ?? ""} role={role} />
        <main className="flex-1">{children}</main>
      </div>
      <ToastProvider />
      <LiveArrivals />
      <OfflineBanner />
      <ServiceWorkerRegister />
    </div>
  );
}
