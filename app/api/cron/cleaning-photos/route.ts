// app/api/cron/cleaning-photos/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { stat, unlink } from "fs/promises";
import path from "path";

const SECRET = process.env.CLEANING_CRON_SECRET || "";
// 로컬 업로드가 /public/uploads 아래에 있다면 지정
const PUBLIC_DIR = process.env.PUBLIC_DIR_ABS || process.cwd() + "/public";

function isLocalUpload(url: string) {
  // 예: /uploads/cleaning/2025/11/07/xxx.jpg
  return url.startsWith("/uploads/");
}

async function removeLocalFileIfAny(url: string) {
  if (!isLocalUpload(url)) return;
  const abs = path.join(PUBLIC_DIR, url);
  try {
    await stat(abs);
    await unlink(abs);
  } catch {
    // 파일이 없으면 무시
  }
}

export async function GET(req: Request) {
  try {
    // 간단한 보호
    const u = new URL(req.url);
    const s = u.searchParams.get("secret") || req.headers.get("x-cron-secret") || "";
    if (!SECRET || s !== SECRET) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    // 기준 시각: 7일 전
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 1) 오래된 사진 목록 조회
    const olds = await prisma.cleaningTaskPhoto.findMany({
      where: { uploadedAt: { lt: cutoff } },
      select: { id: true, url: true },
      orderBy: { id: "asc" },
      take: 5_000, // 안전상 한 번에 많이 지우지 않음
    });

    // 2) 로컬 파일 삭제(해당되는 경우만)
    for (const p of olds) {
      if (p.url) await removeLocalFileIfAny(p.url);
    }

    // 3) DB 레코드 삭제
    const ids = olds.map((x) => x.id);
    if (ids.length) {
      await prisma.cleaningTaskPhoto.deleteMany({ where: { id: { in: ids } } });
    }

    return NextResponse.json({
      ok: true,
      deleted: ids.length,
      cutoff: cutoff.toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}