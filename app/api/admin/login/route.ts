// app/api/admin/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { compare } from "bcryptjs";
import { SignJWT } from "jose";
import { serialize } from "cookie";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "admin_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "";

// 실패 집계
const FAIL_WINDOW_MIN = 10;
const FAIL_LIMIT_LOCK = 5;
const LOCK_MINUTES = 10;
const PERMA_REPEAT = 2;

const ipOf = (req: Request) =>
  (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
  req.headers.get("x-real-ip") ||
  null;

const uaOf = (req: Request) => req.headers.get("user-agent") || "";

export async function POST(req: Request) {
  try {
    if (!SESSION_SECRET) return NextResponse.json({ error: "internal" }, { status: 500 });

    const { email, password } = await req.json().catch(() => ({} as any));
    if (!email || !password) return NextResponse.json({ error: "missing" }, { status: 400 });

    const ip = ipOf(req);
    const ua = uaOf(req);

    // 차단된 IP
    if (ip) {
      const banned = await prisma.adminBannedIP.findFirst({
        where: { ip, OR: [{ until: null }, { until: { gt: new Date() } }] },
      });
      if (banned) return NextResponse.json({ error: "banned" }, { status: 403 });
    }

    const user = await prisma.adminUser.findUnique({
      where: { email },
      select: { id: true, email: true, password: true, role: true },
    });
    if (!user?.password) {
      if (ip) await prisma.adminLoginAudit.create({ data: { adminId: 0, ip, ua, note: "wrong_user" } });
      return NextResponse.json({ error: "invalid" }, { status: 401 });
    }

    const ok = await compare(password, user.password);
    if (!ok) {
      if (ip) {
        await prisma.adminLoginAudit.create({ data: { adminId: user.id, ip, ua, note: "wrong_password" } });

        const since = new Date(Date.now() - FAIL_WINDOW_MIN * 60 * 1000);
        const recentFails = await prisma.adminLoginAudit.count({
          where: { ip, note: "wrong_password", createdAt: { gte: since } },
        });

        if (recentFails >= FAIL_LIMIT_LOCK) {
          const prevLocks = await prisma.adminLoginAudit.count({ where: { ip, note: "lock_applied" } });

          if (prevLocks + 1 >= PERMA_REPEAT) {
            await prisma.adminBannedIP.upsert({
              where: { ip },
              update: { reason: "too_many_failures", until: null },
              create: { ip, reason: "too_many_failures", until: null },
            });
            await prisma.adminLoginAudit.create({ data: { adminId: user.id, ip, ua, note: "banned_permanent" } });
            return NextResponse.json({ error: "banned" }, { status: 403 });
          }

          const until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
          await prisma.adminBannedIP.upsert({
            where: { ip },
            update: { reason: "temp_lock", until },
            create: { ip, reason: "temp_lock", until },
          });
          await prisma.adminLoginAudit.create({ data: { adminId: user.id, ip, ua, note: "lock_applied" } });
          return NextResponse.json({ error: "locked", minutes: LOCK_MINUTES }, { status: 429 });
        }
      }

      let remain: number | undefined;
      if (ip) {
        const since = new Date(Date.now() - FAIL_WINDOW_MIN * 60 * 1000);
        const recentFails = await prisma.adminLoginAudit.count({
          where: { ip, note: "wrong_password", createdAt: { gte: since } },
        });
        remain = Math.max(FAIL_LIMIT_LOCK - recentFails, 0);
      }
      return NextResponse.json({ error: "invalid", remain }, { status: 401 });
    }

    // 성공: 실패기록 일부 정리 + 성공 로그
    if (ip) {
      const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await prisma.adminLoginAudit.deleteMany({
        where: { ip, note: "wrong_password", createdAt: { gte: sinceDay } },
      });
      await prisma.adminLoginAudit.create({ data: { adminId: user.id, ip, ua, note: "success" } });
    }

    // JWT
    const jwt = await new SignJWT({ uid: user.id, email: user.email, role: user.role ?? "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(SESSION_SECRET));

    // ★ DB 세션 기록(로그인된 기기에서 사용)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.adminSession.create({
      data: { adminId: user.id, token: jwt, ip, ua, expiresAt },
    });

    // 쿠키
    const cookie = serialize(COOKIE_NAME, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return new NextResponse(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Set-Cookie": cookie, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}