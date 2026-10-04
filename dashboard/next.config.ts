import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Everything is served from this origin: next/font self-hosts fonts and the browser never
// talks to Supabase directly (only server code does). Next injects small inline bootstrap
// scripts, so script-src needs 'unsafe-inline' until the app moves to per-request nonces.
// The dev server also needs 'unsafe-eval' for React refresh, so CSP is production-only.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  ...(isProd ? [{ key: "Content-Security-Policy", value: csp }] : []),
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.*.*"], // dev only: lets phones on LAN hydrate
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
