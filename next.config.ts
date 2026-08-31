import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output عشان نعمل Docker image خفيف للإنتاج (VPS/Hostinger).
  output: "standalone",
};

export default nextConfig;
