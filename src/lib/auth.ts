import { SignJWT, jwtVerify, JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/src/lib/prisma";

const JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "dev_secret_change_me";
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "admin_session";
const COOKIE_MAX_AGE = Number(process.env.AUTH_COOKIE_MAX_AGE ?? "2592000"); // 30d
const secretKey = new TextEncoder().encode(JWT_SECRET);

/* ===== Password ===== */
export async function hashPassword(raw: string) { const salt = await bcrypt.genSalt(10); return bcrypt.hash(raw, salt); }
export async function verifyPassword(raw: string, hashed: string) { return bcrypt.compare(raw, hashed); }

/* ===== JWT ===== */
export async function signAdminJwt(payload: JWTPayload) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE}s`).sign(secretKey);
}
export async function verifyAdminJwt(token: string) {
  const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
  return payload;
}

/* ===== Cookies (App Router) ===== */
export async function setAuthCookie(token: string) {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: COOKIE_MAX_AGE,
  });
}
export async function clearAuthCookie() {
  (await cookies()).set(COOKIE_NAME, "", {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 0,
  });
}
export async function getAuthTokenFromCookies() { return (await cookies()).get(COOKIE_NAME)?.value ?? null; }

/* ===== Session DB 연동 ===== */
export async function createSession(params: {
  adminId: number; token: string; ip?: string | null; ua?: string | null;
}) {
  const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE * 1000);
  await prisma.adminSession.create({
    data: { adminId: params.adminId, token: params.token, ip: params.ip ?? null, ua: params.ua ?? null, expiresAt },
  });
}

export async function deleteSessionByToken(token: string) {
  await prisma.adminSession.deleteMany({ where: { token } });
}

export async function listSessionsForViewer(viewer: { id: number; role?: string }) {
  const where = (viewer.role ?? "admin") === "owner" ? {} : { adminId: viewer.id };
  return prisma.adminSession.findMany({
    where, orderBy: { createdAt: "desc" }, take: 500,
    select: { id: true, ip: true, ua: true, createdAt: true, expiresAt: true,
      admin: { select: { id: true, email: true } } },
  });
}

/* ===== Identity & Guard ===== */
export type AdminIdentity = { sub?: string; email?: string; role?: string } | null;

export async function getAdminIdentityFromCookie(): Promise<AdminIdentity> {
  const token = await getAuthTokenFromCookies();
  if (!token) return null;
  try {
    // JWT 유효성 + DB 세션 존재 확인
    const p = await verifyAdminJwt(token);
    const sess = await prisma.adminSession.findUnique({ where: { token } });
    if (!sess || sess.expiresAt < new Date()) return null;
    return {
      sub: typeof p.sub === "string" ? p.sub : undefined,
      email: typeof p.email === "string" ? p.email : undefined,
      role: typeof p.role === "string" ? p.role : undefined,
    };
  } catch { return null; }
}

export async function requireAdmin() {
  const token = await getAuthTokenFromCookies();
  if (!token) throw new Error("UNAUTHORIZED");
  const p = await verifyAdminJwt(token).catch(() => { throw new Error("UNAUTHORIZED"); });
  const sess = await prisma.adminSession.findUnique({ where: { token } });
  if (!sess || sess.expiresAt < new Date()) throw new Error("UNAUTHORIZED");
  return {
    id: Number(p.sub), email: String(p.email), role: String(p.role ?? "admin"), token,
  };
}

/* ===== Request helpers ===== */
export function getClientIp(req: NextRequest): string | undefined {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip") || undefined;
}
export function getUserAgent(req: NextRequest): string | undefined {
  return req.headers.get("user-agent") || undefined;
}

/* expose */
export const AUTH_COOKIE_NAME = COOKIE_NAME;