import LogoutButton from "@/components/logout-button";
import GlobalSearch from "@/components/global-search";
import NotificationsBell from "@/components/notifications-bell";

const roleLabels: Record<string, string> = {
  doctor: "طبيب",
  receptionist: "سكرتارية / استقبال",
};

interface TopbarProps {
  clinicName: string;
  userName: string;
  role: string;
}

export default function Topbar({ clinicName, userName, role }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 print:hidden">
      <div className="px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="shrink-0">
          <h1 className="font-bold text-slate-800 text-sm sm:text-base">{clinicName}</h1>
          <p className="text-xs text-slate-500">
            {userName} — {roleLabels[role] ?? role}
          </p>
        </div>

        <GlobalSearch />

        <div className="shrink-0 flex items-center gap-1">
          <NotificationsBell />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
