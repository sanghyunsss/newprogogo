// app/api/cleaning/photos/purge/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * POST /api/cleaning/photos/purge
 * body: { days?: number }  // 기본 10
 * DB 레코드만 삭제. (외부 저장소 파일은 별도 정리 정책 사용)
 */
export async function POST(req: Request) {
  const j = await req.json().catch(() => ({}));
  const days = Number(j.days || 10);
  if (!Number.isFinite(days) || days <= 0) return NextResponse.json({ error: "bad_days" }, { status: 400 });

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const r = await prisma.cleaningTaskPhoto.deleteMany({
    where: { uploadedAt: { lt: cutoff } },
  });
  return NextResponse.json({ ok: true, deleted: r.count, days });
}