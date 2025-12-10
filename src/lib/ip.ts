// src/lib/ip.ts
export function getClientIP(headers: Headers): string {
  const xff = headers.get("x-forwarded-for") || headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0].trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "0.0.0.0";
}