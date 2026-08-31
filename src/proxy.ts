import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Proxy خفيف (Edge runtime) بيستخدم authConfig بس، من غير أي
// اعتماد على "pg"/"bcryptjs" (Node-only). منطق السماح/المنع نفسه
// موجود في authConfig.callbacks.authorized.
const { auth: proxyHandler } = NextAuth(authConfig);

export const proxy = proxyHandler;
export default proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
