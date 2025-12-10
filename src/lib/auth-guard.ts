// src/lib/auth-guard.ts
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "admin_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "";

type AdminUserLite = { id: number; email: string; role: "owner" | "admin" };

export async function getAdminFromCookie(): Promise<AdminUserLite> {
  if (!SESSION_SECRET) throw new Error("UNAUTHORIZED");
  const c = (await cookies()).get(COOKIE_NAME)?.value;
  if (!c) throw new Error("UNAUTHORIZED");

  const { payload } = await jwtVerify(
    c,
    new TextEncoder().encode(SESSION_SECRET)
  );

  const id = Number(payload.uid);
  const email = String(payload.email || "");
  const role = (payload.role as "owner" | "admin") ?? "admin";
  if (!id || !email) throw new Error("UNAUTHORIZED");

  return { id, email, role };
}

export async function requireAdmin(role?: "owner" | "admin") {
  const u = await getAdminFromCookie();
  if (role === "owner" && u.role !== "owner") throw new Error("FORBIDDEN");
  return u;
}