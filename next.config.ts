import type { NextConfig } from "next";
import path from "path";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-UNGRD-Security", value: "protocol-v1" },
];

const nextConfig: NextConfig = {
  // Standalone solo fuera de Vercel (Docker / Alibaba). En Vercel + Next 16.3
  // `output: "standalone"` rompe onBuildComplete (ENOENT next-server.js.nft.json).
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: path.join(__dirname),
  },
  // Oculta el badge flotante "N" de Next.js Dev Tools en local
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
