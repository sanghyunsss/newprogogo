// app/api/cleaning/tasks/route.ts  ← 전체 교체
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** YYYY-MM-DD 검사 */
function asYMD(s: string | null): string | null {
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** 하루 경계 [gte, lt) — UTC 자정 기준 */
function dayBoundsUTC(ymd: string) {
  const gte = new Date(`${ymd}T00:00:00.000Z`);
  const lt  = new Date(`${ymd}T24:00:00.000Z`);
  return { gte, lt };
}

export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const ymd  = asYMD(url.searchParams.get("date")) ?? new Date().toISOString().slice(0,10);
    const { gte, lt } = dayBoundsUTC(ymd);

    // 오늘 작업표 (날짜 정확히 일치가 아닌 [gte, lt)로 비교)
    const tasks = await prisma.cleaningTask.findMany({
      where: { date: { gte, lt } },
      include: {
        worker: true,
        room:   true,
        photos: { orderBy: { uploadedAt: "desc" } }, // 스키마에 uploadedAt 존재 전제
      },
      orderBy: { roomId: "asc" },
    });

    // 실퇴실 이벤트 보강
    const roomIds = [...new Set(tasks.map(t => t.roomId))];
    let lastCheckoutByRoom = new Map<number, Date>();

    if (roomIds.length) {
      const events = await prisma.event.findMany({
        where: {
          roomId: { in: roomIds },
          // checkout / CHECKOUT 둘 다 허용
          type: { in: ["checkout", "CHECKOUT"] },
          ts: { gte, lt },
        },
        orderBy: { ts: "desc" },
      });
      for (const e of events) if (!lastCheckoutByRoom.has(e.roomId)) lastCheckoutByRoom.set(e.roomId, e.ts);
    }

    const rows = tasks.map(t => ({
      ...t,
      checkoutTime: t.checkoutTime ?? lastCheckoutByRoom.get(t.roomId) ?? null,
    }));

    return NextResponse.json({ rows });
  } catch (e: any) {
    // 에러 내용을 바로 확인 가능하게 반환
    return NextResponse.json(
      { ok: false, error: "internal", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const j = await req.json().catch(() => ({}));
    const mode = String(j.mode || "");

    if (mode === "assign") {
      const roomId   = Number(j.roomId || 0);
      const workerId = j.workerId ? Number(j.workerId) : null;
      const guestId  = j.guestId ? Number(j.guestId) : null;
      const ymd      = asYMD(String(j.date || "")); // 안전 파싱
      if (!roomId || !ymd) return NextResponse.json({ error: "bad_params" }, { status: 400 });
      const { gte, lt } = dayBoundsUTC(ymd);

      // 당일 실퇴실 이벤트 추출
      const ev = await prisma.event.findFirst({
        where: {
          roomId,
          type: { in: ["checkout", "CHECKOUT"] },
          ts: { gte, lt },
        },
        orderBy: { ts: "desc" },
      });

      // [roomId, day] 고유키 기준 upsert
      await prisma.cleaningTask.upsert({
        where: { roomId_date: { roomId, date: gte } }, // 스키마가 date 자정 고정이라면 gte 사용
        create: { roomId, date: gte, workerId, guestId, checkoutTime: ev?.ts ?? null },
        update: { workerId, guestId, checkoutTime: ev?.ts ?? undefined },
      });

      return NextResponse.json({ ok: true });
    }

    if (mode === "update") {
      const taskId = Number(j.taskId || 0);
      if (!taskId) return NextResponse.json({ error: "bad_params" }, { status: 400 });
      const data: any = {};
      if (j.status) data.status = j.status;
      if (j.memo !== undefined) data.memo = j.memo;
      if (j.workerId !== undefined) data.workerId = j.workerId || null;
      await prisma.cleaningTask.update({ where: { id: taskId }, data });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "bad_mode" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "internal", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}