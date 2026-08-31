import type { Metadata } from "next";
// الخط Tajawal مدمج جوه المشروع (self-hosted) — مفيش أي اعتماد على Google
// Fonts عشان الخط يطلع مظبوط وسريع حتى في الشبكات اللي بتحجب/تبطّئ سيرفراتهم.
import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/500.css";
import "@fontsource/tajawal/700.css";
import "@fontsource/tajawal/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "نظام إدارة العيادات",
  description: "منصة SaaS لإدارة العيادات — المواعيد، الملفات الطبية، والإدارة المالية",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
