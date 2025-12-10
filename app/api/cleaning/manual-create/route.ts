// src/app/api/cleaning/manual-create/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { asDateAt00UTC } from "@/lib/cleaning";

/** 당일 UTC 구간 [gte, lt) */
function dayRangeUTC(dateStr: string) {
  const gte = new Date(`${dateStr}T00:00:00Z`);
  const lt = new Date(`${dateStr}T00:00:00Z`);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

export async function POST(req: Request) {
  const j = await req.json().catch(() => ({}));

  const roomId = Number(j.roomId || 0);
  const dateStr = String(j.date || "");
  const workerId = j.workerId != null ? (Number(j.workerId) || null) : null;
  const memo = j.memo != null ? String(j.memo) : null;

  if (!roomId || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "bad_params" }, { status: 400 });
  }

  const day = asDateAt00UTC(dateStr);

  // 실퇴실 시각
  let checkoutTime: Date | null = null;
  if (j.checkoutTime) {
    const ct = new Date(String(j.checkoutTime));
    if (!Number.isNaN(ct.getTime())) checkoutTime = ct;
  }
  // 미지정 시 당일 최신 checkout 이벤트 자동 보강
  if (!checkoutTime) {
    const { gte, lt } = dayRangeUTC(dateStr);
    const ev = await prisma.event.findFirst({
      where: { roomId, type: "checkout", ts: { gte, lt } },
      orderBy: { ts: "desc" },
    });
    checkoutTime = ev?.ts ?? null;
  }

  // roomId+date 기준 upsert (중복 방지)
  const row = await prisma.cleaningTask.upsert({
    where: { roomId_date: { roomId, date: day } },
    create: { roomId, date: day, workerId, memo, checkoutTime },
    update: { workerId, memo, checkoutTime: checkoutTime ?? undefined },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, taskId: row.id });
}