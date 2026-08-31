import type { Metadata } from "next";
import "./globals.css";

// الخط: في بيئات التطوير بدون إنترنت (مثل الـ sandbox) استيراد Cairo من
// Google Fonts بيفشل الـ build، فبنستخدم fallback عربي محلي، ويفضل
// <link> التحميل من Google Fonts (المتصفح يجيبه لو متاح) في الإنتاج.
// في الإنتاج على VPS بإنترنت، الخط بيتحمّل عادي من الـ CDN.

export const metadata: Metadata = {
  title: "نظام إدارة العيادات",
  description: "منصة SaaS لإدارة العيادات — المواعيد، الملفات الطبية، والإدارة المالية",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
