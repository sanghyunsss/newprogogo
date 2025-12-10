// app/api/admin/security/log/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export const runtime = "nodejs"; // Edge 아님

function ipFrom(req: NextRequest) {
  const xf = req.headers.get("x-forwarded-for") || "";
  const first = xf.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  const ip = ipFrom(req);
  const ua = req.headers.get("user-agent") || "";
  const path = req.headers.get("x-path") || req.nextUrl.pathname;
  const who = req.cookies.get(process.env.AUTH_COOKIE_NAME ?? "admin_session")?.value ?? null;

  // 기록 (Prisma 모델이 없으면 아래 ❷ 참고)
  await prisma.adminRequestLog.create({ data: { ip, ua, path, who } });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  // 헬스체크 용
  return NextResponse.json({ ok: true, hint: "POST to write" });
}