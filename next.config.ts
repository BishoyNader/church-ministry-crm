import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

// Production security headers (Sprint 2 — Security Hardening).
// - CSP allows 'unsafe-inline' for scripts/styles because Next.js hydration
//   injects inline RSC payloads; a nonce-based strict CSP is the documented
//   follow-up (see docs/security/SPRINT2_SECURITY_REVIEW.md).
// - HSTS is applied only in production (never on local http dev servers).
// - connect-src is restricted to self + hosted Supabase. Hosted projects are
//   covered by the https://*.supabase.co wildcard; a self-hosted/local instance
//   (e.g. http://127.0.0.1:54321) is added dynamically from the runtime env so
//   the browser client (session refresh, RBAC reads, RPC calls, realtime) is
//   not blocked by the CSP — the local dev app otherwise renders AccessDenied
//   everywhere because every client-side Supabase fetch is refused.
function buildConnectSrc(): string[] {
  const sources = ["'self'", "https://*.supabase.co", "wss://*.supabase.co"];
  const raw =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const supabaseUrl = raw.replace(/\/$/, "");
  const hosted = /^https:\/\/[^/]+\.supabase\.co$/.test(supabaseUrl);
  if (supabaseUrl && !hosted) {
    sources.push(supabaseUrl);
    sources.push(supabaseUrl.replace(/^http/, "ws"));
  }
  return sources;
}

const baseSecurityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src ${buildConnectSrc().join(" ")}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    const headers = [...baseSecurityHeaders];

    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [{ source: "/:path*", headers }];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
