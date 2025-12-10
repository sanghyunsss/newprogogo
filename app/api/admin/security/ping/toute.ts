export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { getClientIp, getUserAgent, getAuthTokenFromCookies, verifyAdminJwt } from "@/src/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // 로그인 세션에서 이메일 확인
    const token = await getAuthTokenFromCookies();
    if (!token) return NextResponse.json({ ok: false, error: "no-session" }, { status: 401 });
    const payload = await verifyAdminJwt(token).catch(() => null);
    const email = (payload as any)?.email as string | undefined;
    if (!email) return NextResponse.json({ ok: false, error: "no-email" }, { status: 401 });

    const ip = getClientIp(req) ?? null;
    const ua = getUserAgent(req) ?? null;

    // 온라인 세션 upsert
    await prisma.adminSession.upsert({
      where: { email },
      create: { email, ip, ua, lastSeen: new Date() },
      update: { ip, ua, lastSeen: new Date() },
    });

    // 접속 로그 남기기(선택)
    await prisma.adminAccessLog.create({
      data: { email, ip, ua, note: "ping" }
    });

    return NextResponse.json({ ok: true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message ?? String(e) }, { status: 500 });
  }
}