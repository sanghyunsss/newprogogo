// app/api/cleaning/_auth.ts
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const COOKIE_CANDIDATES = ["sid", "admin_session_v3", process.env.AUTH_COOKIE_NAME || "admin_session"];
const SESSION_SECRET = process.env.SESSION_SECRET || "";

export type AdminSession = { uid: number; email: string; role?: string } | null;

export async function getAdmin(): Promise<AdminSession> {
  if (!SESSION_SECRET) return null;
  const ck = await cookies();
  let token = "";
  for (const name of COOKIE_CANDIDATES) {
    const v = ck.get(name)?.value;
    if (v) { token = v; break; }
  }
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SESSION_SECRET));
    const uid = Number(payload.uid);
    if (!Number.isFinite(uid) || uid <= 0) return null;
    return { uid, email: String(payload.email || ""), role: String(payload.role || "admin") };
  } catch {
    return null;
  }
}