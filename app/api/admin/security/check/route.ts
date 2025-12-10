export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

// 미들웨어에서 x-forwarded-for/x-real-ip를 전달해줌
function getIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined
  );
}

export async function GET(req: NextRequest) {
  try {
    const ip = getIp(req);
    if (!ip) return NextResponse.json({ ok: true }); // IP 없으면 통과

    const ban = await prisma.adminBannedIP.findUnique({ where: { ip } }).catch(() => null);
    const now = Date.now();
    const banned = !!ban && (!ban.until || new Date(ban.until).getTime() > now);

    return banned
      ? NextResponse.json({ ok: false, banned: true }, { status: 403 })
      : NextResponse.json({ ok: true, banned: false });
  } catch {
    // 장애 시 차단으로 간주하지 않음
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}