"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarIcon,
  DashboardIcon,
  ExpensesIcon,
  InventoryIcon,
  PatientsIcon,
  ReportsIcon,
  StethoscopeIcon,
  SearchIcon,
  QueueIcon,
  ClockIcon,
  GlobeLinkIcon,
} from "./icons";

const navItems = [
  { href: "/dashboard", label: "لوحة التحكم", icon: DashboardIcon, match: (p: string) => p === "/dashboard" },
  { href: "/appointments", label: "المواعيد", icon: CalendarIcon, match: (p: string) => p.startsWith("/appointments") },
  { href: "/queue", label: "غرفة الانتظار", icon: QueueIcon, match: (p: string) => p.startsWith("/queue") },
  { href: "/follow-ups", label: "متابعة المرضى", icon: ClockIcon, match: (p: string) => p.startsWith("/follow-ups") },
  { href: "/patients", label: "ملفات المرضى", icon: PatientsIcon, match: (p: string) => p.startsWith("/patients") },
  { href: "/patients/winback", label: "استعادة الغائبين", icon: SearchIcon, match: (p: string) => p.startsWith("/patients/winback") },
  { href: "/visits/new", label: "الكشف والمدفوعات", icon: StethoscopeIcon, match: (p: string) => p.startsWith("/visits") },
  { href: "/inventory", label: "المخزون", icon: InventoryIcon, match: (p: string) => p.startsWith("/inventory") },
  { href: "/expenses", label: "المصروفات", icon: ExpensesIcon, match: (p: string) => p.startsWith("/expenses") },
  { href: "/reports", label: "التقارير المالية", icon: ReportsIcon, match: (p: string) => p.startsWith("/reports") && !p.startsWith("/reports/doctors") },
  { href: "/reports/doctors", label: "أداء الأطباء", icon: StethoscopeIcon, match: (p: string) => p.startsWith("/reports/doctors") },
  { href: "/visits/compare", label: "مقارنة الزيارات", icon: SearchIcon, match: (p: string) => p.startsWith("/visits/compare") },
  { href: "/settings/booking", label: "الحجز الأونلاين", icon: GlobeLinkIcon, match: (p: string) => p.startsWith("/settings/booking") },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="group fixed inset-y-0 right-0 z-30 w-16 hover:w-60 bg-white border-l border-slate-200
                 transition-[width] duration-200 ease-out overflow-hidden flex flex-col shadow-sm print:hidden"
    >
      <div className="h-16 flex items-center justify-center shrink-0 border-b border-slate-100">
        <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
          ع
        </div>
      </div>

      <ul className="flex-1 py-3 space-y-1 px-2.5">
        {navItems.map((item) => {
          const isActive = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-2.5 py-2.5 whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-sky-50 text-sky-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
