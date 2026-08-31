import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

/**
 * إعدادات خفيفة لـ NextAuth تُستخدم في الـ middleware (Edge runtime).
 * ممنوع نستورد هنا أي حاجة بتعتمد على "pg" أو "bcryptjs" لأنها
 * مكتبات Node.js مش متوافقة مع الـ Edge runtime.
 * الإعدادات الكاملة (فيها Credentials provider) موجودة في src/auth.ts
 * وبتشتغل بس في الـ Route Handlers / Server Components (Node runtime).
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  // لازم نثق في الـ Host جاي من الـ reverse proxy (Caddy/Nginx) في
  // الإنتاج، وإلا NextAuth بيرفض الطلب بـ "UntrustedHost". آمن هنا
  // لأن Caddy هو اللي بيستقبل الترافيك من برّه مباشرة على 443/80.
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      const isApiPath =
        pathname.startsWith("/api") &&
        !pathname.startsWith("/api/auth") &&
        !pathname.startsWith("/api/public") &&
        pathname !== "/api/health";
      // المسارات العامة (من غير تسجيل دخول):
      //  - /api/health: مراقبة الـ uptime
      //  - /api/public/*: صفحات العيادة العامة (حجز أونلاين + شاشة الانتظار)
      //  - /b/*: صفحة الحجز الأونلاين للمريض
      //  - /screen/*: شاشة الانتظار (التلفزيون في الاستقبال)
      const isPublicPath =
        pathname === "/login" ||
        pathname.startsWith("/api/auth") ||
        pathname === "/api/health" ||
        pathname.startsWith("/api/public") ||
        pathname.startsWith("/b/") ||
        pathname.startsWith("/screen/");

      if (!isLoggedIn && isApiPath) {
        // لـ API endpoints نرجّع 401 JSON بدل Redirect لصفحة الدخول (HTML)
        return NextResponse.json({ error: "غير مصرّح بالدخول" }, { status: 401 });
      }

      if (!isLoggedIn && !isPublicPath) return false;

      if (isLoggedIn && pathname === "/login") {
        return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
